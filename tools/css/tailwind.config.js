// Cores e fontes da marca Cooperlink. Lê as classes usadas no HTML e nos textos de JavaScript do site.
module.exports = {
  content: ['../../index.html', '../../js/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#041020',
          navy: '#081d38',
          blue: '#0c3b6d',
          light: '#145293',
          accent: '#1e6bc4',
          orange: '#f36621',
          darkorange: '#d65415'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  }
};
