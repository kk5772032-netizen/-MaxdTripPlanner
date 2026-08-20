import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../../theme';

/**
 * Onboarding illustrations.
 *
 * Drawn rather than shipped as images: they are flat vector shapes in the
 * brand palette, so as SVG they stay sharp at any density, recolour with the
 * theme, and add nothing to the bundle.
 */

export function RouteArt({ size = 240 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size * 0.83} viewBox="0 0 240 200">
      <Rect x={8} y={18} width={224} height={164} rx={14} fill={t.surfaceSunken} />
      <Path d="M8 92h224M8 138h224M74 18v164M158 18v164" stroke="#E7EBF0" strokeWidth={7} />
      <Path
        d="M52 150 L118 106 L186 62"
        stroke={t.primary}
        strokeWidth={3.5}
        strokeDasharray="9 7"
        strokeLinecap="round"
      />
      {[[52, 150, '1'], [118, 106, '2'], [186, 62, '3']].map(([cx, cy, n]) => (
        <Circle key={String(n)} cx={cx as number} cy={cy as number} r={13} fill={t.primary} />
      ))}
      {[[52, 155, '1'], [118, 111, '2'], [186, 67, '3']].map(([x, y, n]) => (
        <SvgText
          key={String(n)}
          x={x as number}
          y={y as number}
          fontSize={13}
          fontWeight="700"
          fill="#fff"
          textAnchor="middle"
        >
          {n}
        </SvgText>
      ))}
    </Svg>
  );
}

export function BudgetArt({ size = 240 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size * 0.83} viewBox="0 0 240 200">
      <Rect x={14} y={34} width={212} height={90} rx={14} fill="#fff" stroke={t.border} />
      <Circle cx={42} cy={60} r={12} fill={t.primarySoft} />
      <SvgText x={42} y={65} fontSize={12} fontWeight="700" fill={t.primary} textAnchor="middle">
        1
      </SvgText>
      <Rect x={62} y={53} width={88} height={9} rx={4.5} fill={t.borderStrong} />
      <Rect x={62} y={70} width={56} height={7} rx={3.5} fill={t.border} />
      <Rect x={30} y={96} width={180} height={10} rx={5} fill={t.surfaceSunken} />
      <Rect x={30} y={96} width={58} height={10} rx={5} fill={t.under} />
      <Rect x={14} y={136} width={102} height={46} rx={12} fill="#fff" stroke={t.border} />
      <Rect x={30} y={152} width={16} height={16} rx={4} fill={t.under} />
      <Rect x={54} y={157} width={46} height={7} rx={3.5} fill={t.border} />
      <Rect x={124} y={136} width={102} height={46} rx={12} fill="#fff" stroke={t.border} />
      <Rect x={140} y={150} width={20} height={20} rx={5} fill={t.categories.food} opacity={0.18} />
      <Rect x={168} y={157} width={44} height={7} rx={3.5} fill={t.border} />
    </Svg>
  );
}

export function TrackArt({ size = 240 }: { size?: number }) {
  const t = useTheme();
  const ring = (color: string, dash: string, offset: number) => (
    <Circle
      cx={120}
      cy={86}
      r={56}
      fill="none"
      stroke={color}
      strokeWidth={26}
      strokeDasharray={dash}
      strokeDashoffset={offset}
    />
  );
  return (
    <Svg width={size} height={size * 0.83} viewBox="0 0 240 200">
      {ring(t.categories.food, '126 226', 0)}
      {ring(t.categories.transport, '100 252', -130)}
      {ring(t.categories.activity, '70 282', -234)}
      {ring(t.categories.lodging, '52 300', -308)}
      <Rect x={60} y={164} width={120} height={30} rx={15} fill={t.nearSoft} />
      <SvgText x={120} y={184} fontSize={13} fontWeight="600" fill={t.near} textAnchor="middle">
        Close to cap
      </SvgText>
    </Svg>
  );
}
