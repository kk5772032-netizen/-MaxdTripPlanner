import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { type PlanData, planAsHtml, planAsText, planFileName } from './exportPlan';

/**
 * Getting the plan out of the app.
 *
 * Two routes, because they are answers to different questions. "Send this to
 * my sister" wants text in a chat thread, which is what people actually do
 * with an itinerary. "Print this for the hotel desk" wants a PDF. Offering
 * only the PDF would be the tidier engineering answer and the wrong one — a
 * PDF attachment is a file someone has to open, and a plan you have to open is
 * a plan nobody reads on the way to the airport.
 */

export type ShareOutcome =
  | { ok: true }
  /** The user backed out. Not an error, and nothing should be said about it. */
  | { ok: false; reason: null }
  | { ok: false; reason: string };

/** Straight into a message thread. Uses the OS share sheet, not a file. */
export async function sharePlanAsText(data: PlanData): Promise<ShareOutcome> {
  const message = planAsText(data);

  if (Platform.OS === 'web') {
    // `navigator.share` exists on mobile browsers and almost nowhere else, so
    // the clipboard is the honest fallback rather than a dead button.
    const nav = globalThis.navigator as
      | {
          share?: (data: { title?: string; text?: string }) => Promise<void>;
          clipboard?: { writeText: (text: string) => Promise<void> };
        }
      | undefined;
    try {
      if (nav?.share) {
        await nav.share({ title: data.trip.name, text: message });
        return { ok: true };
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(message);
        return { ok: false, reason: 'Copied the plan to your clipboard.' };
      }
    } catch {
      // A cancelled share and a blocked clipboard look the same here.
      return { ok: false, reason: null };
    }
    return { ok: false, reason: "This browser can't share." };
  }

  try {
    const result = await Share.share({ title: data.trip.name, message });
    return result.action === Share.dismissedAction ? { ok: false, reason: null } : { ok: true };
  } catch (e) {
    console.warn('[sharePlan] text share failed', e);
    return { ok: false, reason: "Couldn't open the share sheet." };
  }
}

/**
 * Renders the plan to a PDF and hands it to the share sheet.
 *
 * On web there is no file to hand anywhere, so this opens the browser's print
 * dialog instead — where "Save as PDF" is one of the destinations.
 */
export async function sharePlanAsPdf(data: PlanData): Promise<ShareOutcome> {
  const html = planAsHtml(data);

  if (Platform.OS === 'web') {
    try {
      await Print.printAsync({ html });
      return { ok: true };
    } catch {
      return { ok: false, reason: null };
    }
  }

  let uri: string;
  try {
    ({ uri } = await Print.printToFileAsync({ html }));
  } catch (e) {
    console.warn('[sharePlan] pdf render failed', e);
    return { ok: false, reason: "Couldn't make a PDF of this trip." };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) {
      // The file exists and is in the app's cache; there is just nowhere to
      // send it. Saying where it went beats claiming nothing happened.
      return { ok: false, reason: 'Sharing is unavailable on this device.' };
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: data.trip.name,
    });
    return { ok: true };
  } catch (e) {
    console.warn('[sharePlan] pdf share failed', e);
    return { ok: false, reason: "Couldn't share the PDF." };
  }
}

/** Exported for the tests, and for anything that wants the name without the IO. */
export { planFileName };
