// Aplica el tema guardado antes de pintar para evitar parpadeos.
try {
  var t = localStorage.getItem('digesta:theme');
  if (t === 'oscuro' || ((!t || t === 'sistema') && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) {}
