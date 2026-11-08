import { SignUpPage } from './pages/SignUpPage/SignUpPage.js';
import { LoginPage } from './pages/LoginPage/LoginPage.js';
import { HomePage } from './pages/HomePage/HomePage.js';
import { PinPage } from './pages/PinPage/PinPage.js';
import { ProfilePage } from './pages/ProfilePage/ProfilePage.js';

export const routes = [
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
