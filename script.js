document.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.shell');
  if (!shell) return;

  shell.addEventListener('pointermove', (event) => {
    const rect = shell.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    shell.style.transform = `perspective(1000px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg)`;
  });

  shell.addEventListener('pointerleave', () => {
    shell.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  });
});
