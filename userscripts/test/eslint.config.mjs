import globals from "globals";
export default [{
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.browser, msgpack: "readonly" } },
    rules: {
        "no-undef": "error", "no-unreachable": "error", "no-dupe-keys": "error", "no-dupe-class-members": "error", "no-duplicate-case": "error",
        "no-self-assign": "error", "no-func-assign": "error", "no-redeclare": "error", "use-isnan": "error", "valid-typeof": "error",
        "no-eval": "error", "no-implied-eval": "error", "no-new-func": "error",
        "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-shadow": "warn"
    }
}];
