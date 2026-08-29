import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PACKING_TEMPLATES, type PackingTemplate } from '../../packing/templates';
import { useTripStore } from '../../state/tripStore';
import { useToastStore } from '../../state/toastStore';
import { elevation, makeStyles, radius, spacing, type, useTheme } from '../../theme';
import type { PackingItem, Trip } from '../../types';
import { Checkbox } from '../Checkbox';
import { Button, Card, IconButton, Input, Sheet, SheetOption, notifySuccess } from '../ui';

/**
 * What to take.
 *
 * The two days before leaving are this app's busiest hours and it had nothing
 * to offer them. The list groups itself by whatever categories the items carry,
 * because people group their own way — "carry-on", "for the baby" — and a fixed
 * set of categories is a fight with every one of them.
 */
export function PackingSection({ trip }: { trip: Trip }) {
  const styles = useStyles();
  const { packing, addPacking, addPackingTemplate, updatePacking, removePacking, unpackAll } =
    useTripStore();
  const show = useToastStore((s) => s.show);

  const [title, setTitle] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const packed = packing.filter((i) => i.packed).length;
  const groups = useMemo(() => groupByCategory(packing), [packing]);

  const add = async () => {
    const text = title.trim();
    if (!text) return;
    await addPacking({ title: text, category: null });
    setTitle('');
    notifySuccess();
  };

  const applyTemplate = async (template: PackingTemplate) => {
    const added = await addPackingTemplate(template.items);
    setTemplatesOpen(false);
    show({
      message:
        added === 0
          ? `Everything in ${template.label} is already on your list`
          : `Added ${added} ${added === 1 ? 'item' : 'items'}`,
    });
  };

  return (
    <View style={styles.section}>
      <Card style={styles.form}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Sunscreen"
          returnKeyType="done"
          onSubmitEditing={() => void add()}
          accessibilityLabel="Something to pack"
        />
        <View style={styles.formRow}>
          <View style={styles.grow}>
            <Button
              title="Add"
              icon="add"
              onPress={() => void add()}
              disabled={!title.trim()}
            />
          </View>
          <View style={styles.grow}>
            <Button
              title="Starter lists"
              icon="sparkles-outline"
              variant="secondary"
              onPress={() => setTemplatesOpen(true)}
            />
          </View>
        </View>
      </Card>

      {packing.length === 0 ? (
        <Text style={styles.empty}>
          Nothing on the list yet. Add what you would forget, or start from one of the
          starter lists.
        </Text>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {packed} of {packing.length} packed
            </Text>
            {packed > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Untick everything"
                onPress={() => void unpackAll()}
                hitSlop={8}
              >
                <Text style={styles.reset}>Untick all</Text>
              </Pressable>
            ) : null}
          </View>

          {groups.map(([category, items]) => (
            <View key={category ?? 'ungrouped'} style={styles.group}>
              {category ? <Text style={styles.groupTitle}>{category}</Text> : null}
              <View style={styles.list}>
                {items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    onToggle={() => void updatePacking(item.id, { packed: !item.packed })}
                    onRemove={() => void removePacking(item.id)}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.hint}>Tap to tick off, long-press to remove.</Text>
        </>
      )}

      <Sheet
        visible={templatesOpen}
        title="Start from a list"
        subtitle="A first draft, not the list. Everything is yours to edit once it lands."
        onClose={() => setTemplatesOpen(false)}
      >
        {PACKING_TEMPLATES.map((template) => (
          <SheetOption
            key={template.id}
            icon={template.icon}
            title={template.label}
            body={template.description}
            onPress={() => void applyTemplate(template)}
          />
        ))}
      </Sheet>
    </View>
  );
}

function Row({
  item,
  onToggle,
  onRemove,
}: {
  item: PackingItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.packed }}
      accessibilityLabel={item.title}
      onPress={onToggle}
      onLongPress={onRemove}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Checkbox checked={item.packed} />
      <Text style={[styles.itemTitle, item.packed && styles.itemPacked]} numberOfLines={2}>
        {item.title}
      </Text>
      <IconButton
        icon="close"
        label={`Remove ${item.title}`}
        size={30}
        onPress={onRemove}
      />
    </Pressable>
  );
}

/**
 * Grouped by whatever categories the items happen to carry, in the order they
 * first appear. Uncategorised items go last, under no heading — they are the
 * ones you typed in a hurry, and inventing an "Other" heading for them would
 * be the app tidying up after you rather than getting out of the way.
 */
function groupByCategory(items: PackingItem[]): [string | null, PackingItem[]][] {
  const groups = new Map<string | null, PackingItem[]>();
  for (const item of items) {
    const key = item.category?.trim() || null;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return 0;
  });
}

const useStyles = makeStyles((t) => ({
  section: { gap: spacing.lg },
  form: { gap: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },

  empty: { ...type.body, color: t.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg },

  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { ...type.label, color: t.textMuted },
  reset: { ...type.label, color: t.primary },

  group: { gap: spacing.sm },
  groupTitle: { ...type.captionStrong, color: t.textMuted },
  list: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
    ...elevation.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  itemPressed: { backgroundColor: t.bg },
  itemTitle: { flex: 1, ...type.body, color: t.text },
  itemPacked: { color: t.textFaint, textDecorationLine: 'line-through' },

  hint: { ...type.caption, color: t.textFaint, textAlign: 'center' },
}));
