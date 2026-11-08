import { fetchPinById, fetchPins } from '../../api/user.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import { Header } from '../../components/Header/Header.js';
import template from './PinPage.hbs';

export class PinPage {
    /**
     * @param {string|number} pinId
     * @param {Object} [options]
     * @param {import('../../routes.js').Router} [options.router] - роутер для переходов.
     */
    constructor(pinId, { router } = {}) {
        this.pinId = String(pinId);
        this.router = router;
        this.pin = null;
        this.element = null;
        /** @type {number|null} */
        this.loadingTimer = null;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild;

        this.element.prepend(new Header({ router: this.router }).render());

        this.setupEvents();
        this.loadData();

        return this.element;
    }

    async loadData() {
        // Показываем лоадер, только если запрос реально «завис» (>600 мс),
        // иначе быстрый ответ вообще не вызовет мигания.
        this.loadingTimer = setTimeout(() => {
            this.element?.querySelector('#pinLoading')?.removeAttribute('hidden');
        }, 600);

        try {
            this.pin = await fetchPinById(this.pinId);

            // Сначала показываем сам пин — рекомендации догрузим отдельно.
            this.renderPin();
            void this.loadRecommendations();
        } catch (err) {
            this.element.querySelector('#pinLoading').hidden = true;
            this.element.querySelector('#pinError').hidden = false;
            this.element.querySelector('#pinErrorMessage').textContent = err.message || 'Ошибка загрузки';
        } finally {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    async loadRecommendations() {
        try {
            const res = await fetchPins(36);
            const allPins = res.pins || [];
            const otherPins = allPins.filter((p) => String(p.pin_id) !== this.pinId);
            this.renderRecommendations(otherPins);
        } catch (e) {
            console.warn('Не удалось загрузить рекомендации', e);
        }
    }

    renderPin() {
        const img = this.element.querySelector('#pinMainImage');
        img.src = this.pin.image_url;
        img.alt = this.pin.name || 'Пин';
        img.onerror = () => img.classList.add('pin-main-image--failed');

        // Заголовок (прячем заглушки вида "Pin 1")
        const title = this.element.querySelector('#pinTitle');
        const name = this.pin.name || '';
        if (name && !/^pin\s*#?\s*\d+$/i.test(name.trim())) {
            title.textContent = name;
            title.hidden = false;
        } else {
            title.hidden = true;
        }

        // Описание
        const desc = this.element.querySelector('#pinDescription');
        desc.textContent = this.pin.description || '';
        desc.hidden = !this.pin.description;

        // Автор
        const isMyPin = String(this.pin.creator_id) === localStorage.getItem('userId');
        const authorName = isMyPin ? (localStorage.getItem('userName') || 'Вы') : 'Автор пина';
        this.element.querySelector('#pinAuthorName').textContent = authorName;

        const avatar = this.element.querySelector('#pinAuthorAvatar');
        const avatarUrl = localStorage.getItem('userAvatarUrl');
        if (isMyPin && avatarUrl) {
            avatar.innerHTML = `<img src="${avatarUrl}" alt="">`;
            avatar.classList.add('pin-author-avatar--image');
        } else {
            avatar.textContent = authorName[0].toUpperCase();
        }

        // Показываем основной блок
        this.element.querySelector('#pinLoading').hidden = true;
        this.element.querySelector('#pinLayout').hidden = false;

        this.updateLike();
        this.updateSave();
        this.renderComments();
    }

    renderRecommendations(otherPins) {
        const sideBox = this.element.querySelector('#pinSideRecommendations');
        sideBox.innerHTML = '';
        otherPins.slice(0, 10).forEach((p) => {
            sideBox.append(new PinCard(p).render());
        });

        const bottomBox = this.element.querySelector('#pinBottomRecommendations');
        bottomBox.innerHTML = '';
        otherPins.slice(10).forEach((p) => {
            bottomBox.append(new PinCard(p).render());
        });
    }

    setupEvents() {
        // Лайк
        this.element.querySelector('[data-action="like"]').addEventListener('click', () => {
            const likes = JSON.parse(localStorage.getItem('pickking:liked-pins') || '[]');
            const index = likes.indexOf(this.pinId);

            if (index === -1) {
                likes.push(this.pinId);
            } else {
                likes.splice(index, 1);
            }

            localStorage.setItem('pickking:liked-pins', JSON.stringify(likes));
            this.updateLike();
        });

        // Сохранить
        this.element.querySelector('[data-action="save"]').addEventListener('click', () => {
            const saved = JSON.parse(localStorage.getItem('pickking:saved-pins') || '[]');
            const index = saved.indexOf(this.pinId);

            if (index === -1) {
                saved.push(this.pinId);
            } else {
                saved.splice(index, 1);
            }

            localStorage.setItem('pickking:saved-pins', JSON.stringify(saved));
            this.updateSave();
        });

        // Поделиться
        const shareBtn = this.element.querySelector('[data-action="share"]');
        shareBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                shareBtn.textContent = '✓';
                shareBtn.classList.add('is-active');
                setTimeout(() => {
                    shareBtn.textContent = '↗';
                    shareBtn.classList.remove('is-active');
                }, 1500);
            } catch {
                // Игнорируем ошибку, если браузер заблокировал буфер обмена
            }
        });

        // Комментарии
        this.element.querySelector('#pinCommentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = this.element.querySelector('#pinCommentInput');
            const text = input.value.trim();
            if (!text) return;

            const key = `pickking:comments:${this.pinId}`;
            const comments = JSON.parse(localStorage.getItem(key) || '[]');
            comments.push({
                author: localStorage.getItem('userName') || 'Вы',
                text: text,
            });

            localStorage.setItem(key, JSON.stringify(comments));
            input.value = '';
            this.renderComments();
        });
    }

    updateLike() {
        const likes = JSON.parse(localStorage.getItem('pickking:liked-pins') || '[]');
        const isLiked = likes.includes(this.pinId);
        const btn = this.element.querySelector('[data-action="like"]');

        btn.classList.toggle('is-active', isLiked);
        btn.querySelector('.pin-heart').textContent = isLiked ? '♥' : '♡';
        btn.querySelector('[data-like-count]').textContent = isLiked ? '1' : '0';
    }

    updateSave() {
        const saved = JSON.parse(localStorage.getItem('pickking:saved-pins') || '[]');
        const isSaved = saved.includes(this.pinId);
        const btn = this.element.querySelector('[data-action="save"]');

        btn.classList.toggle('is-active', isSaved);
        btn.textContent = isSaved ? 'Сохранено' : 'Сохранить';
    }

    renderComments() {
        const key = `pickking:comments:${this.pinId}`;
        const comments = JSON.parse(localStorage.getItem(key) || '[]');
        const list = this.element.querySelector('#pinCommentsList');

        list.innerHTML = '';
        comments.forEach((c) => {
            const item = document.createElement('article');
            item.className = 'pin-comment';

            const author = document.createElement('strong');
            author.textContent = c.author;

            const text = document.createElement('p');
            text.textContent = c.text;

            item.append(author, text);
            list.append(item);
        });

        this.element.querySelector('#pinCommentsCount').textContent = comments.length;
    }
}
