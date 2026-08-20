import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetArt, RouteArt, TrackArt } from '../src/components/onboarding/art';
import { Button } from '../src/components/ui';
import { useSettingsStore } from '../src/state/settingsStore';
import { makeStyles, spacing, type } from '../src/theme';

const PANELS = [
  {
    key: 'route',
    Art: RouteArt,
    title: 'Plan the route, not just the trip',
    body: "Add the places you want to see, in the order you'll see them.",
  },
  {
    key: 'budget',
    Art: BudgetArt,
    title: 'Decide what it should cost',
    body: 'Give each stop a budget, then plan the things to do and places to eat inside it.',
  },
  {
    key: 'track',
    Art: TrackArt,
    title: 'Watch it as it happens',
    body: 'Log what you actually spend. Waypoint tells you the moment a stop starts running over.',
  },
] as const;

export default function OnboardingScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSetting = useSettingsStore((s) => s.set);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  const finish = async () => {
    await setSetting('onboarded', true);
    router.replace('/trips');
  };

  const next = () => {
    if (index === PANELS.length - 1) return void finish();
    const to = index + 1;
    setIndex(to);
    scroller.current?.scrollTo({ x: to * width, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const last = index === PANELS.length - 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.skipRow}>
        {!last ? (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => void finish()}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.pager}
      >
        {PANELS.map(({ key, Art }) => (
          <View key={key} style={[styles.art, { width }]}>
            <Art />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.xxl + insets.bottom }]}>
        <Text style={styles.title}>{PANELS[index].title}</Text>
        <Text style={styles.body}>{PANELS[index].body}</Text>

        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${index + 1} of ${PANELS.length}`}
        >
          {PANELS.map((panel, i) => (
            <View key={panel.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Button
          title={last ? 'Get started' : 'Next'}
          onPress={next}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.surface },
  skipRow: { height: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: spacing.lg },
  skip: { ...type.body, color: t.textMuted },
  pager: { flex: 1 },
  art: { alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.md, alignItems: 'center' },
  title: { ...type.title, color: t.text, textAlign: 'center' },
  body: { ...type.body, color: t.textMuted, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.md, marginBottom: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.borderStrong },
  dotActive: { width: 20, backgroundColor: t.primary },
  cta: { alignSelf: 'stretch' },
}));
