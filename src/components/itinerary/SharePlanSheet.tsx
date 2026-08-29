import { useState } from 'react';
import { Platform } from 'react-native';

import type { PlanData } from '../../itinerary/exportPlan';
import {
  sharePlanAsCalendar,
  sharePlanAsPdf,
  sharePlanAsText,
} from '../../itinerary/sharePlan';
import { useToastStore } from '../../state/toastStore';
import { Sheet, SheetOption } from '../ui';

/**
 * "Send this to someone" — the two answers, and nothing else.
 *
 * Message first, because that is what happens to an itinerary in practice: it
 * gets pasted into the group chat. The PDF is for the times a piece of paper is
 * the point — a hotel desk, a visa appointment, a parent who prints things.
 */
export function SharePlanSheet({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: PlanData;
  onClose: () => void;
}) {
  const show = useToastStore((s) => s.show);
  const [busy, setBusy] = useState(false);

  const run = async (share: (d: PlanData) => Promise<Awaited<ReturnType<typeof sharePlanAsText>>>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await share(data);
      // Backing out of a share sheet needs no comment; the user just did it.
      if (!result.ok && result.reason) show({ message: result.reason });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Share this plan"
      subtitle="Days, times, stops and what you have booked. Nothing about money."
      onClose={onClose}
    >
      <SheetOption
        icon="chatbubble-ellipses-outline"
        title="Send as a message"
        body="Plain text, straight into WhatsApp or email."
        disabled={busy}
        onPress={() => void run(sharePlanAsText)}
      />
      <SheetOption
        icon="document-text-outline"
        title="Save as a PDF"
        body={
          Platform.OS === 'web'
            ? 'Opens your print dialog — choose "Save as PDF".'
            : 'A printable copy you can send or keep offline.'
        }
        disabled={busy}
        onPress={() => void run(sharePlanAsPdf)}
      />
      <SheetOption
        icon="calendar-outline"
        title="Add to your calendar"
        body="A calendar file every app can open — Google, Apple, Outlook."
        disabled={busy}
        onPress={() => void run(sharePlanAsCalendar)}
      />
    </Sheet>
  );
}
