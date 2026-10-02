Handlebars.registerHelper('isPassword', (type) => type === 'password');

import { SignUpPage } from "./pages/SignUpPage/SignUpPage.js";
import { LoginPage } from "./pages/LoginPage/LoginPage.js";

const root = document.getElementById("root");

function renderPage() {
    root.innerHTML = '';
    const hash = window.location.hash;

    if (hash === '#/signup') {
        const page = new SignUpPage();
        root.append(page.render());
    } else if (hash === '#/login') {
        const page = new LoginPage();
        root.append(page.render());
    } else {
        const page = new LoginPage();
        root.append(page.render());
    }
}

renderPage();
window.addEventListener('hashchange', renderPage);