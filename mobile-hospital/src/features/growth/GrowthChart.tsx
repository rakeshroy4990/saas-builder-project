import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { GrowthMetric } from '@/features/growth/growthApi';
import type { GrowthRecordRow } from '@/features/growth/growthHelpers';
import type { WhoCurvePoint } from '@/features/growth/growthChartContext';
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  computeChartGeometry,
  yAxisTitleKey
} from '@/features/growth/growthChartGeometry';

type GrowthChartProps = {
  metric: GrowthMetric;
  records: GrowthRecordRow[];
  percentileCurves: Record<string, WhoCurvePoint[]>;
  geneticTargetCurve: WhoCurvePoint[];
  showGeneticLine: boolean;
  geneticTargetMarker?: { ageMonths: number; value: number } | null;
};

export function GrowthChart({
  metric,
  records,
  percentileCurves,
  geneticTargetCurve,
  showGeneticLine,
  geneticTargetMarker = null
}: GrowthChartProps) {
  const { t } = useTranslation();
  const geometry = computeChartGeometry(
    metric,
    records,
    percentileCurves,
    geneticTargetCurve,
    showGeneticLine,
    geneticTargetMarker
  );

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {geometry.yTicks.map((tick) => (
          <Line
            key={`y-grid-${tick.value}`}
            x1={geometry.pad.left}
            y1={tick.y}
            x2={CHART_WIDTH - geometry.pad.right}
            y2={tick.y}
            stroke="#f1f5f9"
          />
        ))}
        {geometry.xTicks.map((tick) => (
          <Line
            key={`x-grid-${tick.value}`}
            x1={tick.x}
            y1={geometry.plotTop}
            x2={tick.x}
            y2={geometry.plotBottom}
            stroke="#f1f5f9"
          />
        ))}
        <Line
          x1={geometry.pad.left}
          y1={geometry.plotBottom}
          x2={CHART_WIDTH - geometry.pad.right}
          y2={geometry.plotBottom}
          stroke="#cbd5e1"
        />
        <Line
          x1={geometry.pad.left}
          y1={geometry.plotTop}
          x2={geometry.pad.left}
          y2={geometry.plotBottom}
          stroke="#cbd5e1"
        />
        {geometry.yTicks.map((tick) => (
          <SvgText
            key={`y-label-${tick.value}`}
            x={geometry.pad.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={10}
            fill="#64748b"
          >
            {tick.label}
          </SvgText>
        ))}
        {geometry.xTicks.map((tick) => (
          <SvgText
            key={`x-label-${tick.value}`}
            x={tick.x}
            y={geometry.plotBottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {tick.label}
          </SvgText>
        ))}
        <SvgText
          x={(geometry.pad.left + CHART_WIDTH - geometry.pad.right) / 2}
          y={CHART_HEIGHT - 10}
          textAnchor="middle"
          fontSize={11}
          fontWeight="600"
          fill="#475569"
        >
          {t('growth.chart.ageMonths')}
        </SvgText>
        <G transform={`rotate(-90, 14, ${(geometry.plotTop + geometry.plotBottom) / 2})`}>
          <SvgText
            x={14}
            y={(geometry.plotTop + geometry.plotBottom) / 2}
            textAnchor="middle"
            fontSize={11}
            fontWeight="600"
            fill="#475569"
          >
            {t(yAxisTitleKey(metric))}
          </SvgText>
        </G>
        {geometry.curvePath('P3') ? (
          <Path d={geometry.curvePath('P3')} stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 3" fill="none" />
        ) : null}
        {geometry.curvePath('P50') ? (
          <Path d={geometry.curvePath('P50')} stroke="#94a3b8" strokeWidth={1.5} fill="none" />
        ) : null}
        {geometry.curvePath('P97') ? (
          <Path d={geometry.curvePath('P97')} stroke="#fdba74" strokeWidth={1} strokeDasharray="4 3" fill="none" />
        ) : null}
        {geometry.geneticPath ? (
          <Path d={geometry.geneticPath} stroke="#0d9488" strokeWidth={2} strokeDasharray="6 4" fill="none" />
        ) : null}
        {geometry.geneticTargetMarker ? (
          <>
            <Circle
              cx={geometry.geneticTargetMarker.x}
              cy={geometry.geneticTargetMarker.y}
              r={9}
              fill="none"
              stroke="#0d9488"
              strokeWidth={2}
              opacity={0.35}
            />
            <Circle
              cx={geometry.geneticTargetMarker.x}
              cy={geometry.geneticTargetMarker.y}
              r={5}
              fill="#0d9488"
              stroke="#ffffff"
              strokeWidth={2}
            />
          </>
        ) : null}
        {geometry.childLine ? (
          <Path d={geometry.childLine} stroke="#2563eb" strokeWidth={2.5} fill="none" />
        ) : null}
        {geometry.scaledPoints.map((pt, idx) => (
          <Circle key={`pt-${idx}`} cx={pt.x} cy={pt.y} r={4} fill="#2563eb" />
        ))}
      </Svg>
      <View style={styles.legend}>
        <LegendSwatch color="#2563eb" label={t('growth.chart.legendChild')} />
        <LegendSwatch color="#94a3b8" label={t('growth.chart.legendP50')} />
        <LegendSwatch color="#fca5a5" label={t('growth.chart.legendP3')} dashed />
        <LegendSwatch color="#fdba74" label={t('growth.chart.legendP97')} dashed />
        {showGeneticLine ? (
          <LegendSwatch color="#0d9488" label={t('growth.chart.legendGeneticTarget')} dashed />
        ) : null}
      </View>
    </View>
  );
}

function LegendSwatch({
  color,
  label,
  dashed
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendLine,
          { backgroundColor: dashed ? 'transparent' : color, borderColor: color },
          dashed ? styles.legendLineDashed : null
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%'
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1
  },
  legendLineDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    height: 0
  },
  legendText: {
    fontSize: 11,
    color: '#64748b'
  }
});
