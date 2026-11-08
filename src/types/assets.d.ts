interface ImportMetaEnv {
    readonly PROD: boolean;
    readonly DEV: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module '*.hbs' {
    const template: (context?: Record<string, unknown>) => string;
    export default template;
}