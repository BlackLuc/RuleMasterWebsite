const mobileMenuButton = document.getElementById("mobileMenuButton");
const mobileMenu = document.getElementById("mobileMenu");
const year = document.getElementById("year");

function closeMobileMenu() {
  mobileMenu.classList.remove("active");
  mobileMenuButton.setAttribute("aria-expanded", "false");
  mobileMenuButton.setAttribute("aria-label", "Open menu");
  mobileMenuButton.querySelector("span").textContent = "☰";
}

mobileMenuButton.addEventListener("click", () => {
  const isOpen = mobileMenu.classList.toggle("active");

  mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  mobileMenuButton.setAttribute(
    "aria-label",
    isOpen ? "Close menu" : "Open menu"
  );
  mobileMenuButton.querySelector("span").textContent = isOpen ? "×" : "☰";
});

mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMobileMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

year.textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (!reduceMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-revealed");
        currentObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".feature-card").forEach((card) => {
    observer.observe(card);
  });
}
