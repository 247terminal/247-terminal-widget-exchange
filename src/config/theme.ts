import config from './_index.ts';

export type ThemeConfig = typeof config.theme.defaults;

export function build_theme(exchange_config?: Partial<ThemeConfig>): ThemeConfig {
    const defaults = config.theme.defaults;

    if (!exchange_config) return defaults;

    return {
        colors: { ...defaults.colors, ...exchange_config.colors },
        fonts: { ...defaults.fonts, ...exchange_config.fonts },
        font_sizes: { ...defaults.font_sizes, ...exchange_config.font_sizes },
        spacing: { ...defaults.spacing, ...exchange_config.spacing },
        radii: { ...defaults.radii, ...exchange_config.radii },
        shadows: { ...defaults.shadows, ...exchange_config.shadows },
        breakpoints: { ...defaults.breakpoints, ...exchange_config.breakpoints },
    };
}

