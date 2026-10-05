(function() {
  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};
templates["Button.hbs"] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<button type=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"type") || (depth0 != null ? lookupProperty(depth0,"type") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"type","hash":{},"data":data,"loc":{"start":{"line":1,"column":14},"end":{"line":1,"column":22}}}) : helper)))
    + "\" class=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"className") || (depth0 != null ? lookupProperty(depth0,"className") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"className","hash":{},"data":data,"loc":{"start":{"line":1,"column":31},"end":{"line":1,"column":44}}}) : helper)))
    + "\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"title") || (depth0 != null ? lookupProperty(depth0,"title") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"title","hash":{},"data":data,"loc":{"start":{"line":1,"column":46},"end":{"line":1,"column":55}}}) : helper)))
    + "</button>\r\n";
},"useData":true});
templates["Input.hbs"] = template({"0":function(container,depth0,helpers,partials,data) {
    return "            <img src=\"/public/img/eye-closed.png\" alt=\"Показать пароль\" class=\"eye-icon-img\">\r\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=container.hooks.helperMissing, alias3="function", alias4=container.escapeExpression, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"input-wrapper\">\r\n    <label for=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":2,"column":16},"end":{"line":2,"column":24}}}) : helper)))
    + "\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"label") || (depth0 != null ? lookupProperty(depth0,"label") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"label","hash":{},"data":data,"loc":{"start":{"line":2,"column":26},"end":{"line":2,"column":35}}}) : helper)))
    + "</label>\r\n\r\n    <div class=\"input-field-container\">\r\n        <input type=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"type") || (depth0 != null ? lookupProperty(depth0,"type") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"type","hash":{},"data":data,"loc":{"start":{"line":5,"column":21},"end":{"line":5,"column":29}}}) : helper)))
    + "\" id=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":5,"column":35},"end":{"line":5,"column":43}}}) : helper)))
    + "\" name=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"name") || (depth0 != null ? lookupProperty(depth0,"name") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"name","hash":{},"data":data,"loc":{"start":{"line":5,"column":51},"end":{"line":5,"column":59}}}) : helper)))
    + "\" placeholder=\""
    + alias4(((helper = (helper = lookupProperty(helpers,"placeholder") || (depth0 != null ? lookupProperty(depth0,"placeholder") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"placeholder","hash":{},"data":data,"loc":{"start":{"line":5,"column":74},"end":{"line":5,"column":89}}}) : helper)))
    + "\">\r\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(lookupProperty(helpers,"isPassword")||(depth0 && lookupProperty(depth0,"isPassword"))||alias2).call(alias1,(depth0 != null ? lookupProperty(depth0,"type") : depth0),{"name":"isPassword","hash":{},"data":data,"loc":{"start":{"line":6,"column":14},"end":{"line":6,"column":31}}}),{"name":"if","hash":{},"fn":container.program(0, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":6,"column":8},"end":{"line":8,"column":15}}})) != null ? stack1 : "")
    + "    </div>\r\n\r\n    <span class=\"error-msg\">"
    + alias4(((helper = (helper = lookupProperty(helpers,"error") || (depth0 != null ? lookupProperty(depth0,"error") : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"error","hash":{},"data":data,"loc":{"start":{"line":11,"column":28},"end":{"line":11,"column":37}}}) : helper)))
    + "</span>\r\n</div>";
},"useData":true});
templates["HomePage.hbs"] = template({"0":function(container,depth0,helpers,partials,data) {
    return "                <img src=\"/public/img/logo_reg.png\" alt=\"Logo\" class=\"logo-img-small\">\r\n";
},"1":function(container,depth0,helpers,partials,data) {
    return "                <img src=\"/public/img/logo_no_reg.png\" alt=\"Logo\" class=\"logo-img-small\">\r\n";
},"2":function(container,depth0,helpers,partials,data) {
    var helper, lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "                <div class=\"user-menu-wrapper\">\r\n                    <div class=\"user-avatar\" id=\"userAvatar\" title=\"Профиль\"></div>\r\n                    <div class=\"user-dropdown\">\r\n                        <div class=\"user-name\">"
    + container.escapeExpression(((helper = (helper = lookupProperty(helpers,"userName") || (depth0 != null ? lookupProperty(depth0,"userName") : depth0)) != null ? helper : container.hooks.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"userName","hash":{},"data":data,"loc":{"start":{"line":24,"column":47},"end":{"line":24,"column":59}}}) : helper)))
    + "</div>\r\n                        <button class=\"btn-logout\" id=\"logoutBtn\" type=\"button\">Выйти</button>\r\n                    </div>\r\n                </div>\r\n";
},"3":function(container,depth0,helpers,partials,data) {
    return "                <a class=\"btn-header btn-login-header\" href=\"/login\" style=\"display: flex; align-items: center; text-decoration: none;\">Вход</a>\r\n                <a class=\"btn-header btn-register-header\" href=\"/signup\" style=\"display: flex; align-items: center; text-decoration: none;\">Регистрация</a>\r\n";
},"4":function(container,depth0,helpers,partials,data) {
    return "                <div class=\"pin-card\"><img src=\""
    + container.escapeExpression(container.lambda(depth0, depth0))
    + "\" alt=\"Pin\"></div>\r\n";
},"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {}), lookupProperty = container.lookupProperty || function(parent, propertyName) {
        if (Object.prototype.hasOwnProperty.call(parent, propertyName)) {
          return parent[propertyName];
        }
        return undefined
    };

  return "<div class=\"home-page\">\r\n    <header class=\"home-header\">\r\n        <div class=\"header-left\">\r\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"isAuth") : depth0),{"name":"if","hash":{},"fn":container.program(0, data, 0),"inverse":container.program(1, data, 0),"data":data,"loc":{"start":{"line":4,"column":12},"end":{"line":8,"column":19}}})) != null ? stack1 : "")
    + "            <span class=\"logo-text-small\">PicKing</span>\r\n        </div>\r\n\r\n        <div class=\"header-center\">\r\n            <div class=\"search-container\">\r\n                <img src=\"/public/img/search.png\" alt=\"Search\" class=\"search-icon\">\r\n                <input type=\"text\" placeholder=\"Поиск\" class=\"search-input\">\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"header-right\">\r\n"
    + ((stack1 = lookupProperty(helpers,"if").call(alias1,(depth0 != null ? lookupProperty(depth0,"isAuth") : depth0),{"name":"if","hash":{},"fn":container.program(2, data, 0),"inverse":container.program(3, data, 0),"data":data,"loc":{"start":{"line":20,"column":12},"end":{"line":31,"column":19}}})) != null ? stack1 : "")
    + "        </div>\r\n    </header>\r\n\r\n    <aside class=\"home-sidebar\" id=\"homeSidebar\">\r\n        <nav class=\"sidebar-nav\">\r\n            <a class=\"sidebar-item\" href=\"/home\" title=\"Главная\">\r\n                <img src=\"/public/img/home.png\" alt=\"Главная\" class=\"sidebar-icon\">\r\n                <span class=\"sidebar-label\">Главная</span>\r\n            </a>\r\n            <a class=\"sidebar-item\" href=\"#\" data-action=\"create\" title=\"Создать\">\r\n                <img src=\"/public/img/plus.png\" alt=\"Создать\" class=\"sidebar-icon\">\r\n                <span class=\"sidebar-label\">Создать</span>\r\n            </a>\r\n            <a class=\"sidebar-item\" href=\"#\" data-action=\"chat\" title=\"Чат\">\r\n                <img src=\"/public/img/chat.png\" alt=\"Чат\" class=\"sidebar-icon\">\r\n                <span class=\"sidebar-label\">Чат</span>\r\n            </a>\r\n        </nav>\r\n    </aside>\r\n\r\n    <main class=\"home-content\">\r\n        <div class=\"pins-grid\">\r\n"
    + ((stack1 = lookupProperty(helpers,"each").call(alias1,(depth0 != null ? lookupProperty(depth0,"pins") : depth0),{"name":"each","hash":{},"fn":container.program(4, data, 0),"inverse":container.noop,"data":data,"loc":{"start":{"line":54,"column":12},"end":{"line":56,"column":21}}})) != null ? stack1 : "")
    + "        </div>\r\n    </main>\r\n\r\n    <button class=\"sidebar-toggle\" id=\"sidebarToggle\" type=\"button\" title=\"Меню\">\r\n        <img src=\"/public/img/toggle.png\" alt=\"Меню\">\r\n    </button>\r\n</div>\r\n";
},"useData":true});
templates["LoginPage.hbs"] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"login-box\">\r\n    <div class=\"box-header\">\r\n        <div class=\"logo-area\">\r\n            <img src=\"/public/img/logo_straight.png\" class=\"logo-img\" alt=\"logo\">\r\n            <span class=\"logo-text\">PicKing</span>\r\n        </div>\r\n        <button class=\"close-btn\" type=\"button\">×</button>\r\n    </div>\r\n\r\n    <h2 class=\"welcome-title\">Добро пожаловать</h2>\r\n\r\n    <div class=\"form-container\"></div>\r\n    <a href=\"#\" class=\"forgot-link\">Забыли пароль?</a>\r\n\r\n    <div class=\"form-server-error\" id=\"serverError\"></div>\r\n\r\n    <div class=\"buttons-container\"></div>\r\n</div>\r\n";
},"useData":true});
templates["SignUpPage.hbs"] = template({"compiler":[8,">= 4.3.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"sign-up-box\">\r\n    <div class=\"box-header\">\r\n        <div class=\"logo-area\">\r\n            <img src=\"/public/img/logo_straight.png\" alt=\"Logo\" class=\"logo-img\">\r\n            <span class=\"logo-text\">PicKing</span>\r\n        </div>\r\n        <button type=\"button\" class=\"close-btn\">×</button>\r\n    </div>\r\n\r\n    <h2 class=\"welcome-title\">Добро пожаловать</h2>\r\n\r\n    <div class=\"form-container\"></div>\r\n\r\n    <div class=\"form-server-error\" id=\"serverError\"></div>\r\n\r\n    <div class=\"login-link-container\">\r\n        <a href=\"/login\" class=\"login-link\">Уже есть аккаунт? Войти</a>\r\n    </div>\r\n</div>\r\n";
},"useData":true});
})();