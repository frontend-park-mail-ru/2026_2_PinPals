/** Объект роутера, который страницы используют для переходов. */
export type Router = {
    navigateTo: (url: string) => void;
    getBackUrl?: (fallback?: string) => string;
    navigateBack?: (fallback?: string) => void;
    refreshHeader?: () => void;
};

/** Описание одного маршрута приложения. */
export type AppRoute = {
    pattern: RegExp;
    pages: (match: RegExpExecArray, context: { router: Router }) => Array<{
        key: string;
        instance: {
            render: () => HTMLElement;
            destroy?: () => void;
            refreshHeader?: () => void;
        };
    }>;
};

import { SignUpPage } from './pages/SignUpPage/SignUpPage';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { HomePage } from './pages/HomePage/HomePage';
import { PinPage } from './pages/PinPage/PinPage';
import { ProfilePage } from './pages/ProfilePage/ProfilePage';
import { ProfileEditPage } from './pages/ProfileEditPage/ProfileEditPage';
import { BoardPage } from './pages/BoardPage/BoardPage';
import { CreatePinPage } from './pages/CreatePinPage/CreatePinPage';
import { CreateBoardPage } from './pages/CreateBoardPage/CreateBoardPage';

export const routes: AppRoute[] = [
    {
        pattern: /^\/profile\/edit\/?$/,
        pages: (match, { router }) => [
            { key: 'profile-edit', instance: new ProfileEditPage({ router }) },
        ],
    },
    {
        pattern: /^\/create-board\/?$/,
        pages: (match, { router }) => [
            { key: 'create-board', instance: new CreateBoardPage({ router }) },
        ],
    },
    {
        pattern: /^\/create-pin\/?$/,
        pages: (match, { router }) => [
            { key: 'create-pin', instance: new CreatePinPage({ router }) },
        ],
    },
    {
        pattern: /^\/board\/([^/]+)\/?$/,
        pages: (match, { router }) => [
            { key: `board:${match[1]}`, instance: new BoardPage(decodeURIComponent(match[1]), { router }) },
        ],
    },
    {
        pattern: /^\/profile\/pins\/?$/,
        pages: (match, { router }) => [
            { key: 'profile-pins', instance: new ProfilePage({ router, activeTab: 'pins' }) },
        ],
    },
    {
        pattern: /^\/profile\/boards\/?$/,
        pages: (match, { router }) => [
            { key: 'profile-boards', instance: new ProfilePage({ router, activeTab: 'boards' }) },
        ],
    },
    {
        pattern: /^\/profile\/?$/,
        pages: (match, { router }) => [
            { key: 'profile-root', instance: new ProfilePage({ router, activeTab: 'pins' }) },
        ],
    },
    {
        pattern: /^\/pin\/(\d+)\/?$/,
        pages: (match, { router }) => [
            { key: `pin:${match[1]}`, instance: new PinPage(match[1], { router }) },
        ],
    },
    {
        pattern: /^\/signup\/?$/,
        pages: (match, { router }) => [
            { key: 'home', instance: new HomePage({ router }) },
            { key: 'signup', instance: new SignUpPage({ router }) },
        ],
    },
    {
        pattern: /^\/login\/?$/,
        pages: (match, { router }) => [
            { key: 'home', instance: new HomePage({ router }) },
            { key: 'login', instance: new LoginPage({ router }) },
        ],
    },
    {
        pattern: /.*/,
        pages: (match, { router }) => [
            { key: 'home', instance: new HomePage({ router }) },
        ],
    },
];