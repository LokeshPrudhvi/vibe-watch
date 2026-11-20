import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { displacementMap } from "@/lib/refraction";

interface MapState {
  url: string;
  w: number;
  h: number;
}

/**
 * Real refraction for one floating glass element: an SVG displacement filter used as a
 * backdrop-filter, rebuilt whenever the element changes size. Returns nothing when disabled.
 *
 * `strength` is the max shift in px at the rim.
 */
export function useRefraction<T extends HTMLElement>(enabled: boolean, strength = 34) {
  // callback ref: the navbar swaps elements when it morphs into search mode
  const [el, ref] = useState<T | null>(null);
  const id = `refract-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [map, setMap] = useState<MapState | null>(null);
  const last = useRef("");

  useLayoutEffect(() => {
    if (!enabled || !el) {
      setMap(null);
      last.current = "";
      return;
    }
    let raf = 0;
    const build = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // layout size, not getBoundingClientRect: ignores in-flight layout-animation transforms
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        if (!width || !height) return;
        const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || height / 2, height / 2);
        const key = `${width}x${height}x${radius}`;
        if (key === last.current) return;
        last.current = key;
        const url = displacementMap(width, height, radius);
        if (url) setMap({ url, w: width, h: height });
      });
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [enabled, el]);

  const active = enabled && map;
  const filter: ReactNode = active ? (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
      <filter
        id={id}
        x="0"
        y="0"
        width={map.w}
        height={map.h}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feImage href={map.url} x="0" y="0" width={map.w} height={map.h} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 2} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  ) : null;

  const value = `url(#${id}) blur(calc(var(--glass-blur) * 0.35)) saturate(var(--glass-sat)) brightness(1.05)`;
  const style: CSSProperties | undefined = active ? { backdropFilter: value, WebkitBackdropFilter: value } : undefined;

  return { ref, filter, style };
}
