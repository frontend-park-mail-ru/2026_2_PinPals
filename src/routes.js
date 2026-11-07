import { SignUpPage } from './pages/SignUpPage/SignUpPage.js';
import { LoginPage } from './pages/LoginPage/LoginPage.js';
import { HomePage } from './pages/HomePage/HomePage.js';
import { PinPage } from './pages/PinPage/PinPage.js';


export const routes = [
    {
        pattern: /^\/pin\/(\d+)\/?$/,
        pages: (match, { router }) => [new PinPage(match[1], { router })],
    },
    {
        pattern: /^\/signup\/?$/,
        pages: (match, { router }) => [new HomePage({ router }), new SignUpPage({ router })],
    },
    {
        pattern: /^\/login\/?$/,
        pages: (match, { router }) => [new HomePage({ router }), new LoginPage({ router })],
    },
    {
        // Фолбэк — главная страница для любого нераспознанного пути.
        pattern: /.*/,
        pages: (match, { router }) => [new HomePage({ router })],
    },
];
