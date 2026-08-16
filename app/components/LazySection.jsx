"use client";

import { useEffect, useRef, useState } from "react";

export default function LazySection({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId = null;

    const reveal = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        setVisible(true);
        observer.unobserve(el);
      }, delay);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) reveal();
      },
      { rootMargin: "100px 0px", threshold: 0.05 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`section-lazy-enter ${visible ? "section-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}