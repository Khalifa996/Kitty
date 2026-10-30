// Draws one of Kitty's line icons with react-native-svg (works on the phone and in the browser preview).
import { memo } from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { ICONS } from './icons';

type El = { tag: string; a: Record<string, string> };
const cache = new Map<string, El[]>();
function shapes(name: string): El[] {
  const hit = cache.get(name);
  if (hit) return hit;
  const src = ICONS[name] || ICONS.more, out: El[] = [];
  for (const m of src.matchAll(/<(\w+)\s+([^>]*?)\/>/g)) {
    const a: Record<string, string> = {};
    for (const [, k, v] of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) a[k] = v;
    out.push({ tag: m[1], a });
  }
  cache.set(name, out);
  return out;
}

export const Icon = memo(function Icon({ name, size = 20, colour }: { name: string; size?: number; colour: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {shapes(name).map(({ tag, a }, i) =>
        tag === 'path' ? <Path key={i} d={a.d} />
        : tag === 'circle' ? <Circle key={i} cx={a.cx} cy={a.cy} r={a.r} />
        : tag === 'rect' ? <Rect key={i} x={a.x || 0} y={a.y || 0} width={a.width} height={a.height} rx={a.rx} />
        : tag === 'polyline' ? <Polyline key={i} points={a.points} />
        : null)}
    </Svg>
  );
});
