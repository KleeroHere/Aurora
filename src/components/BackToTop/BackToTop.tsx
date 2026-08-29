import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
import "./BackToTop.css";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(".app-layout__main");
    if (!scrollEl) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setVisible(scrollEl!.scrollTop > scrollEl!.clientHeight * 1.5);
      });
    }
    onScroll();
    scrollEl.addEventListener("scroll", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top surface-glass"
      onClick={() => {
        document.querySelector<HTMLElement>(".app-layout__main")?.scrollTo({ top: 0, behavior: "smooth" });
      }}
      aria-label="Back to top of page"
      title="Back to top"
    >
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
