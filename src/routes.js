import { SignUpPage } from './pages/SignUpPage/SignUpPage.js';
import { LoginPage } from './pages/LoginPage/LoginPage.js';
import { HomePage } from './pages/HomePage/HomePage.js';
import { PinPage } from './pages/PinPage/PinPage.js';
import { ProfilePage } from './pages/ProfilePage/ProfilePage.js';
import { BoardPage } from './pages/BoardPage/BoardPage.js';
import { CreatePinPage } from './pages/CreatePinPage/CreatePinPage.js';
import { CreateBoardPage } from './pages/CreateBoardPage/CreateBoardPage.js';

export const routes = [
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