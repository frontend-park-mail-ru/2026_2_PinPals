Handlebars.registerHelper('isPassword', (type) => type === 'password');

import { SignUpPage } from "./pages/SignUpPage/SignUpPage.js";

const root = document.getElementById("root");

function init() {
    const page = new SignUpPage();
    const pageElement = page.render();
    root.append(pageElement);
}

init();