import './ChatPage.scss';
import template from './ChatPage.hbs';
import { Header } from '../../components/Header/Header';
import { CHAT_PAGE_SIZE, createChat, fetchChatMessages, fetchChats, openChatSocket, sendChatMessage, searchChatUsers, deleteChatMessage } from '../../api/chat';
import { DEFAULT_AVATAR_URL, resolveAvatarUrl } from '../../api/user';
import type { Chat, ChatMessage, User } from '../../types/models';
import type { Router } from '../../routes';
import type { DomRoot } from '../../types/dom';
import { getErrorMessage } from '../../utils/errors';

/** Страница диалогов с историей сообщений и обновлениями через HTTP и WebSocket. */
export class ChatPage {
    private router?: Router;
    private element!: DomRoot;
    private header: Header | null = null;
    private controller = new AbortController();
    private timer?: ReturnType<typeof setInterval>;
    private searchTimer?: ReturnType<typeof setTimeout>;
    private searchVersion = 0;
    private pendingDeleteId: number | null = null;
    private socket: WebSocket | null = null;
    private hasOlder = false;
    private historyLoaded = false;
    // Границу синхронизации сдвигает только загруженная HTTP-история, а не WebSocket.
    private syncedThroughId = 0;
    private loadingOlder = false;
    private conversationVersion = 0;
    private chats: Chat[] = [];
    private messages: ChatMessage[] = [];
    private selected: Chat | null = null;
    private replyId: number | null = null;
    private newChat = false;
    private loading = false;
    private sending = false;
    private opening = false;
    private historyVersion = 0;
    private userId = Number(localStorage.getItem('userId'));
    isDestroyed = false;

    constructor({ router }: { router?: Router } = {}) {
        this.router = router;
    }

    /** Создаёт страницу и подключает обработчики действий пользователя. */
    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild as HTMLElement;
        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        const options = { signal: this.controller.signal };
        this.element.addEventListener('click', this.onClick, options);
        this.element.querySelector('#chatDeleteDialog').addEventListener('close', () => {
            this.pendingDeleteId = null;
        }, options);
        this.element.querySelector('#chatSearch').addEventListener('input', this.onSearch, options);
        this.element.querySelector('#chatText').addEventListener('input', () => this.updateComposer(), options);
        this.element.querySelector('#chatForm').addEventListener('submit', (event) => {
            event.preventDefault();
            void this.send();
        }, options);
        this.element.querySelector('#chatText').addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                void this.send();
            }
        }, options);
        void this.initialize();
        return this.element;
    }

    /** Загружает диалоги и открывает собеседника из параметра user в URL. */
    private async initialize(): Promise<void> {
        await this.refresh();
        if (this.isDestroyed) return;
        const userId = Number(new URLSearchParams(location.search).get('user'));
        if (userId) await this.openUser(userId);
        if (!this.isDestroyed) {
            // Опрос восполняет пропуски при разрыве WebSocket-соединения.
            this.timer = setInterval(() => { void this.refresh(); }, 5000);
        }
    }

    private showError(error: unknown = ''): void {
        if (this.isDestroyed) return;
        const text = typeof error === 'string' ? error : getErrorMessage(error);
        this.element.querySelector('#chatError').textContent = text;
        this.element.querySelector('#chatError').hidden = !text;
        // На мобильном список и переписка показаны по отдельности.
        if (text && !this.selected) this.element.querySelector('#chatListStatus').textContent = text;
    }

    /** Обновляет список диалогов и историю выбранного чата. */
    private async refresh(): Promise<void> {
        if (this.loading || this.sending || this.isDestroyed) return;
        this.loading = true;
        try {
            const chats = await fetchChats(this.controller.signal);
            if (this.isDestroyed) return;
            const changed = JSON.stringify(this.chats) !== JSON.stringify(chats);
            this.chats = chats;
            if (!this.newChat && (changed || !chats.length)) this.renderList();
            if (this.selected) {
                await this.loadHistory();
                if (!this.isDestroyed && this.selected && !this.socket) this.connectSocket(this.selected.chat_id);
            }
        } catch (error: unknown) {
            this.showError(error);
        } finally {
            this.loading = false;
        }
    }

    private avatar(user: User): HTMLImageElement {
        const image = document.createElement('img');
        image.className = 'chat-avatar';
        image.src = resolveAvatarUrl(user.avatar_url);
        image.alt = '';
        image.addEventListener('error', () => { image.src = DEFAULT_AVATAR_URL; }, { once: true });
        return image;
    }

    private renderList(users?: User[]): void {
        const list = this.element.querySelector('#chatList');
        list.replaceChildren();
        const query = this.element.querySelector<HTMLInputElement>('#chatSearch').value.trim().toLocaleLowerCase();
        const chats = this.chats.filter(({ participant }) => `${participant.name} ${participant.user_tag}`.toLocaleLowerCase().includes(query));
        const entries = users || chats.map((chat) => chat.participant);
        entries.forEach((user, index) => {
            const chat = users ? undefined : chats[index];
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'chat-list-item';
            if (chat) {
                button.dataset.chat = String(chat.chat_id);
                button.setAttribute('aria-current', String(this.selected?.chat_id === chat.chat_id));
            } else button.dataset.user = String(user.user_id);
            const copy = document.createElement('span');
            copy.className = 'chat-list-copy';
            const name = document.createElement('strong');
            name.textContent = user.name || user.user_tag;
            const preview = document.createElement('span');
            preview.textContent = chat ? (chat.last_message ? this.messageText(chat.last_message) : 'Начните переписку') : `@${user.user_tag}`;
            copy.append(name, preview);
            button.append(this.avatar(user), copy);
            if (chat?.last_message) {
                const time = document.createElement('time');
                time.className = 'chat-list-time';
                time.dateTime = chat.updated_at;
                time.textContent = new Date(chat.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                button.append(time);
            }
            list.append(button);
        });
        this.element.querySelector('#chatListStatus').textContent = entries.length ? '' : this.newChat
            ? (query ? 'Пользователи не найдены' : 'Введите имя или логин пользователя')
            : (query ? 'Чаты не найдены' : 'У вас пока нет чатов. Нажмите «Новый чат».');
    }

    private onSearch = (): void => {
        clearTimeout(this.searchTimer);
        const version = ++this.searchVersion;
        this.showError();
        this.element.querySelector('#chatNewHint').hidden = !this.newChat;
        if (!this.newChat) { this.renderList(); return; }
        const query = this.element.querySelector<HTMLInputElement>('#chatSearch').value.trim();
        this.element.querySelector('#chatList').replaceChildren();
        if (!query) { this.renderList([]); return; }
        this.element.querySelector('#chatListStatus').textContent = 'Ищем пользователей…';
        // Ждём паузу во вводе, чтобы не отправлять запрос на каждый символ.
        this.searchTimer = setTimeout(() => { void this.searchUsers(query, version); }, 300);
    };

    private async searchUsers(query: string, version: number): Promise<void> {
        try {
            const users = await searchChatUsers(query, this.controller.signal);
            // Результаты предыдущего поискового запроса уже неактуальны.
            if (this.isDestroyed || version !== this.searchVersion || !this.newChat) return;
            this.renderList(users);
        } catch (error: unknown) {
            if (!this.isDestroyed && version === this.searchVersion && this.newChat) {
                this.element.querySelector('#chatListStatus').textContent = getErrorMessage(error);
            }
        }
    }

    private onClick = (event: MouseEvent): void => {
        const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
        if (!target) return;
        if (target.dataset.chat) {
            const chat = this.chats.find((item) => item.chat_id === Number(target.dataset.chat));
            if (chat) this.select(chat);
        } else if (target.dataset.user) void this.openUser(Number(target.dataset.user));
        else if (target.dataset.reply) {
            this.replyId = Number(target.dataset.reply);
            this.renderReply();
            this.element.querySelector('#chatText').focus();
        } else if (target.dataset.delete) {
            this.pendingDeleteId = Number(target.dataset.delete);
            this.element.querySelector<HTMLDialogElement>('#chatDeleteDialog').showModal();
        } else if (target.dataset.action === 'cancel-delete') {
            this.pendingDeleteId = null;
            this.element.querySelector<HTMLDialogElement>('#chatDeleteDialog').close();
        } else if (target.dataset.action === 'confirm-delete') {
            const messageId = this.pendingDeleteId;
            this.pendingDeleteId = null;
            this.element.querySelector<HTMLDialogElement>('#chatDeleteDialog').close();
            if (messageId !== null) void this.removeMessage(messageId);
        } else if (target.dataset.action === 'older') void this.loadOlder();
        else if (target.dataset.action === 'cancel-reply') { this.replyId = null; this.renderReply(); }
        else if (target.dataset.action === 'back') {
            this.historyVersion++;
            this.conversationVersion++;
            this.socket?.close();
            this.socket = null;
            this.selected = null;
            this.replyId = null;
            this.element.classList.remove('chat-page--selected');
            this.element.querySelector('#chatHeading').hidden = true;
            this.element.querySelector('#chatHistory').hidden = true;
            this.element.querySelector('#chatForm').hidden = true;
            this.element.querySelector('#chatEmpty').hidden = false;
            this.showError();
        } else if (target.dataset.action === 'new') {
            this.newChat = !this.newChat;
            target.textContent = this.newChat ? 'К диалогам' : 'Новый чат';
            this.element.querySelector<HTMLInputElement>('#chatSearch').value = '';
            this.element.querySelector<HTMLInputElement>('#chatSearch').placeholder = this.newChat ? 'Имя или логин пользователя' : 'Поиск чатов';
            this.onSearch();
            this.element.querySelector('#chatSearch').focus();
        }
    };

    /** Получает диалог с пользователем и переключается на него. */
    private async openUser(userId: number): Promise<void> {
        if (this.opening) return;
        this.opening = true;
        try {
            const chat = await createChat(userId, this.controller.signal);
            if (this.isDestroyed) return;
            if (!this.chats.some((item) => item.chat_id === chat.chat_id)) this.chats.unshift(chat);
            this.newChat = false;
            this.element.querySelector('#chatNewHint').hidden = true;
            clearTimeout(this.searchTimer);
            this.searchVersion++;
            this.element.querySelector('[data-action="new"]').textContent = 'Новый чат';
            this.element.querySelector<HTMLInputElement>('#chatSearch').value = '';
            this.element.querySelector<HTMLInputElement>('#chatSearch').placeholder = 'Поиск чатов';
            this.renderList();
            this.select(chat);
        } catch (error: unknown) { this.showError(error); }
        finally { this.opening = false; }
    }

    /** Сбрасывает состояние переписки и загружает выбранный диалог. */
    private select(chat: Chat): void {
        if (this.selected?.chat_id === chat.chat_id) return;
        this.socket?.close();
        this.socket = null;
        this.conversationVersion++;
        this.hasOlder = false;
        this.historyLoaded = false;
        this.syncedThroughId = 0;
        this.loadingOlder = false;
        this.selected = chat;
        this.messages = [];
        this.replyId = null;
        this.historyVersion++;
        this.element.querySelector<HTMLTextAreaElement>('#chatText').value = '';
        this.updateComposer();
        this.element.classList.add('chat-page--selected');
        this.element.querySelector('#chatEmpty').hidden = true;
        this.element.querySelector('#chatHeading').hidden = false;
        this.element.querySelector('#chatHistory').hidden = false;
        this.element.querySelector('#chatForm').hidden = false;
        const link = this.element.querySelector<HTMLAnchorElement>('#chatParticipant');
        link.href = `/profile/${chat.participant.user_id}`;
        link.replaceChildren(this.avatar(chat.participant), document.createTextNode(chat.participant.name || chat.participant.user_tag));
        this.element.querySelector('#chatHistory').textContent = 'Загружаем сообщения…';
        this.renderReply();
        if (!this.newChat) this.renderList();
        this.showError();
        this.connectSocket(chat.chat_id);
        void this.loadHistory(true).catch((error: unknown) => this.showError(error));
    }

    /** Синхронизирует историю, догружая сообщения, пропущенные между обновлениями. */
    private async loadHistory(forceScroll = false): Promise<void> {
        const chatId = this.selected?.chat_id;
        if (!chatId) return;
        const version = ++this.historyVersion;
        const latestKnownId = this.syncedThroughId;
        const wasLoaded = this.historyLoaded;
        let messages: ChatMessage[];
        let newestId: number;
        try {
            messages = await fetchChatMessages(chatId, this.controller.signal);
            newestId = messages.at(-1)?.message_id ?? latestKnownId;
            let page = messages;
            // После долгого разрыва между последним известным сообщением и новой
            // страницей может быть больше 50 сообщений. Заполняем этот промежуток.
            while (wasLoaded && page.length === CHAT_PAGE_SIZE
                && page[0].message_id > latestKnownId) {
                if (this.isDestroyed || this.selected?.chat_id !== chatId || version !== this.historyVersion) return;
                page = await fetchChatMessages(chatId, this.controller.signal, page[0].message_id);
                messages = [...page, ...messages];
            }
        } catch (error: unknown) {
            if (this.selected?.chat_id === chatId && version === this.historyVersion) this.showError(error);
            return;
        }
        // Ответ старого запроса не должен заменить другой диалог или результат отправки.
        if (this.isDestroyed || this.selected?.chat_id !== chatId || version !== this.historyVersion) return;
        const history = this.element.querySelector('#chatHistory');
        const atBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
        const initial = !this.historyLoaded;
        if (initial) this.hasOlder = messages.length === CHAT_PAGE_SIZE;
        this.historyLoaded = true;
        this.syncedThroughId = Math.max(latestKnownId, newestId);
        const merged = this.mergeMessages(this.messages, messages);
        const changed = JSON.stringify(this.messages) !== JSON.stringify(merged);
        this.messages = merged;
        if (changed || forceScroll || initial) this.renderMessages();
        if (forceScroll || atBottom) history.scrollTop = history.scrollHeight;
        this.renderReply();
        this.showError();
    }

    private messageText(message: ChatMessage): string {
        return message.deleted_at ? 'Сообщение удалено' : message.body;
    }

    private renderMessages(): void {
        const history = this.element.querySelector('#chatHistory');
        const scrollTop = history.scrollTop;
        history.replaceChildren();
        if (!this.messages.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Напишите первое сообщение';
            history.append(empty);
            return;
        }
        if (this.hasOlder) {
            const older = document.createElement('button');
            older.type = 'button';
            older.dataset.action = 'older';
            older.textContent = this.loadingOlder ? 'Загружаем…' : 'Загрузить предыдущие сообщения';
            older.disabled = this.loadingOlder;
            history.append(older);
        }
        let previousDate = '';
        this.messages.forEach((message) => {
            const date = new Date(message.created_at);
            const label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            if (label !== previousDate) {
                const divider = document.createElement('p');
                divider.className = 'chat-date';
                divider.textContent = label;
                history.append(divider);
                previousDate = label;
            }
            const own = message.author_id === this.userId;
            const article = document.createElement('article');
            article.className = `chat-message${own ? ' chat-message--own' : ''}`;
            article.setAttribute('aria-label', own ? 'Ваше сообщение' : 'Сообщение собеседника');
            if (message.related_to && !message.deleted_at) {
                const quote = document.createElement('blockquote');
                const original = this.messages.find((item) => item.message_id === message.related_to);
                quote.textContent = original ? this.messageText(original) : 'Сообщение недоступно';
                article.append(quote);
            }
            const text = document.createElement('p');
            text.className = 'chat-message-text';
            text.textContent = this.messageText(message);
            const footer = document.createElement('div');
            footer.className = 'chat-message-footer';
            const time = document.createElement('time');
            time.dateTime = message.created_at;
            time.textContent = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            footer.append(time);
            if (!message.deleted_at) {
                const reply = document.createElement('button');
                reply.type = 'button';
                reply.textContent = 'Ответить';
                reply.dataset.reply = String(message.message_id);
                footer.append(reply);
                if (own) {
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.textContent = 'Удалить';
                    remove.title = 'Удалить для обоих участников';
                    remove.dataset.delete = String(message.message_id);
                    footer.append(remove);
                }
            }
            article.append(text, footer);
            history.append(article);
        });
        history.scrollTop = scrollTop;
    }

    private renderReply(): void {
        this.element.querySelector('#chatReply').hidden = this.replyId === null;
        const message = this.messages.find((item) => item.message_id === this.replyId);
        this.element.querySelector('#chatReplyText').textContent = message ? `Ответ: ${this.messageText(message)}` : '';
    }

    private updateComposer(): void {
        const input = this.element.querySelector<HTMLTextAreaElement>('#chatText');
        // Считаем кодовые точки Unicode, как сервер, включая символы вне базовой плоскости.
        const length = Array.from(input.value.trim()).length;
        const tooLong = length > 4000;
        this.element.querySelector('#chatLength').textContent = `${length} / 4000`;
        this.element.querySelector('#chatLengthError').hidden = !tooLong;
        input.setAttribute('aria-invalid', String(tooLong));
        this.element.querySelector<HTMLButtonElement>('#chatSend').disabled = this.sending || !length || tooLong;
    }

    /** Отправляет сообщение и очищает черновик, если пользователь не сменил диалог. */
    private async send(): Promise<void> {
        const input = this.element.querySelector<HTMLTextAreaElement>('#chatText');
        const text = input.value.trim();
        const chatId = this.selected?.chat_id;
        this.updateComposer();
        if (!chatId || !text || Array.from(text).length > 4000 || this.sending) return;
        const version = this.conversationVersion;
        const draft = input.value;
        const replyId = this.replyId;
        this.sending = true;
        this.historyVersion++;
        this.element.querySelector<HTMLButtonElement>('#chatSend').disabled = true;
        input.readOnly = true;
        let sent = false;
        try {
            const message = await sendChatMessage(chatId, text, replyId, this.controller.signal);
            sent = true;
            if (this.isDestroyed) return;
            // Поздний ответ не должен менять черновик после переключения диалога.
            if (this.selected?.chat_id === chatId && version === this.conversationVersion) {
                if (input.value === draft && this.replyId === replyId) {
                    input.value = '';
                    this.replyId = null;
                }
                this.renderReply();
                this.historyVersion++;
                this.messages = this.mergeMessages(this.messages, [message]);
                this.renderMessages();
                const history = this.element.querySelector('#chatHistory');
                history.scrollTop = history.scrollHeight;
                this.showError();
            }
        } catch (error: unknown) {
            if (version === this.conversationVersion) this.showError(error);
        } finally {
            this.sending = false;
            if (!this.isDestroyed) {
                input.readOnly = false;
                this.updateComposer();
                if (sent) void this.refresh();
            }
        }
    }

    /** Удаляет сообщение на сервере и заменяет его текст заглушкой. */
    private async removeMessage(messageId: number): Promise<void> {
        const chatId = this.selected?.chat_id;
        const version = this.conversationVersion;
        if (!chatId) return;
        this.historyVersion++;
        try {
            await deleteChatMessage(chatId, messageId, this.controller.signal);
            if (this.isDestroyed || version !== this.conversationVersion) return;
            this.historyVersion++;
            this.messages = this.messages.map((message) => message.message_id === messageId
                ? { ...message, body: '', deleted_at: new Date().toISOString() } : message);
            if (this.replyId === messageId) this.replyId = null;
            this.renderMessages();
            this.renderReply();
            this.showError();
            void this.refresh();
        } catch (error: unknown) {
            if (version === this.conversationVersion) this.showError(error);
        }
    }

    /** Объединяет сообщения по идентификатору, отдавая приоритет новым данным. */
    private mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
        return [...new Map([...current, ...incoming].map((message) => [message.message_id, message])).values()]
            .sort((a, b) => a.message_id - b.message_id);
    }

    /** Подгружает предыдущую страницу истории, сохраняя положение прокрутки. */
    private async loadOlder(): Promise<void> {
        const chatId = this.selected?.chat_id;
        const beforeId = this.messages[0]?.message_id;
        if (!chatId || !beforeId || this.loadingOlder || !this.hasOlder) return;
        const version = this.conversationVersion;
        this.loadingOlder = true;
        this.renderMessages();
        try {
            const messages = await fetchChatMessages(chatId, this.controller.signal, beforeId);
            if (this.isDestroyed || version !== this.conversationVersion) return;
            const history = this.element.querySelector('#chatHistory');
            const height = history.scrollHeight;
            const top = history.scrollTop;
            this.hasOlder = messages.length === CHAT_PAGE_SIZE;
            this.messages = this.mergeMessages(this.messages, messages);
            this.loadingOlder = false;
            this.renderMessages();
            // Компенсируем высоту добавленных сверху сообщений.
            history.scrollTop = top + history.scrollHeight - height;
        } catch (error: unknown) {
            if (version === this.conversationVersion) this.showError(error);
        } finally {
            if (!this.isDestroyed && version === this.conversationVersion) {
                this.loadingOlder = false;
                const button = this.element.querySelector<HTMLButtonElement>('[data-action="older"]');
                if (button) { button.disabled = false; button.textContent = 'Загрузить предыдущие сообщения'; }
            }
        }
    }

    /** Подключает события WebSocket только для текущего диалога. */
    private connectSocket(chatId: number): void {
        const socket = openChatSocket(chatId);
        this.socket = socket;
        socket.addEventListener('message', (event) => {
            if (this.isDestroyed || this.socket !== socket || this.selected?.chat_id !== chatId) return;
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'error' && typeof payload.error === 'string') {
                    this.showError(payload.error);
                } else if (payload.type === 'message' && payload.message?.chat_id === chatId
                    && Number.isSafeInteger(payload.message.message_id) && typeof payload.message.body === 'string') {
                    const history = this.element.querySelector('#chatHistory');
                    const atBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
                    this.messages = this.mergeMessages(this.messages, [payload.message]);
                    this.renderMessages();
                    if (atBottom) history.scrollTop = history.scrollHeight;
                    void this.refresh();
                }
            } catch { /* Повреждённое событие восполнит периодический HTTP-запрос. */ }
        });
        socket.addEventListener('close', () => { if (this.socket === socket) this.socket = null; });
    }

    refreshHeader(): void { this.header?.refresh(); }

    /** Останавливает таймеры, закрывает соединение и отменяет запросы и обработчики. */
    destroy(): void {
        this.isDestroyed = true;
        clearInterval(this.timer);
        clearTimeout(this.searchTimer);
        this.socket?.close();
        this.socket = null;
        this.controller.abort();
        this.header?.destroy();
        this.header = null;
    }
}
