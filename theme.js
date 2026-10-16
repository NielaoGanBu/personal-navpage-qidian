'use strict';
try {
  document.documentElement.dataset.theme = localStorage.getItem('nav-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch {
  document.documentElement.dataset.theme = 'light';
}
