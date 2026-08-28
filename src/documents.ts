import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Attaching a ticket or voucher to a booking.
 *
 * The picker hands back a URI into a cache directory the OS is free to empty,
 * so the file is copied into the app's own documents folder first. Storing the
 * picker's URI directly produces an attachment that works all afternoon and is
 * gone by the time you're at the airport — the one moment it was for.
 */

export interface Attachment {
  uri: string;
  name: string;
}

export type AttachResult =
  | { ok: true; attachment: Attachment }
  /** Cancelled carries no reason: the user knows what they just did. */
  | { ok: false; reason: string | null };

const FOLDER = 'attachments';

/** Keeps the extension, drops anything that could climb out of the folder. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '');
  return cleaned.slice(0, 120) || 'attachment';
}

export async function attachDocument(): Promise<AttachResult> {
  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      // Tickets arrive as PDFs, screenshots and the occasional .pkpass.
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (e) {
    console.warn('[documents] picker failed', e);
    return { ok: false, reason: "Couldn't open the file picker." };
  }

  if (picked.canceled) return { ok: false, reason: null };

  const asset = picked.assets?.[0];
  if (!asset) return { ok: false, reason: "That file couldn't be read." };

  const name = safeFileName(asset.name ?? 'attachment');

  // The web build has no persistent filesystem to copy into; the blob URI it
  // provides is good for this session, which is the honest limit there.
  if (Platform.OS === 'web') return { ok: true, attachment: { uri: asset.uri, name } };

  try {
    const dir = new Directory(Paths.document, FOLDER);
    // `idempotent` so a second attachment doesn't throw on the existing folder.
    dir.create({ intermediates: true, idempotent: true });

    // Prefixed with the time so two tickets named "ticket.pdf" can coexist.
    const target = new File(dir, `${Date.now()}-${name}`);
    await new File(asset.uri).copy(target);
    return { ok: true, attachment: { uri: target.uri, name } };
  } catch (e) {
    console.warn('[documents] copy failed', e);
    return { ok: false, reason: "Couldn't save a copy of that file." };
  }
}

/** Removes a stored attachment. Best effort: a missing file is already gone. */
export async function deleteAttachment(uri: string | null): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* best effort */
  }
}
