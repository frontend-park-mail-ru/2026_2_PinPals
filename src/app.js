Handlebars.registerHelper('isPassword', (type) => type === 'password');

import { SignUpPage } from "./pages/SignUpPage/SignUpPage.js";
import { LoginPage } from "./pages/LoginPage/LoginPage.js";
import { HomePage } from "./pages/HomePage/HomePage.js";

const root = document.getElementById("root");

function renderPage() {
    root.innerHTML = '';

    const page = new HomePage();
    root.append(page.render());

    const hash = window.location.hash;
    if (hash === '#/signup') {
        const page = new SignUpPage();
        root.append(page.render());
    } else if (hash === '#/login') {
        const page = new LoginPage();
        root.append(page.render());
    }
}

renderPage();
window.addEventListener('hashchange', renderPage);
