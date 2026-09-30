// Keep the footer year current.
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// "Copy email" button: copies the address and confirms for two seconds.
document.querySelectorAll("[data-copy]").forEach((button) => {
  const label = button.textContent;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "Copied!";
    } catch {
      button.textContent = button.dataset.copy;
    }
    setTimeout(() => (button.textContent = label), 2000);
  });
});
