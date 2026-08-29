import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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


/* -------------------------------------------------------------------------- */
/* Photos                                                                     */
/* -------------------------------------------------------------------------- */

const PHOTO_FOLDER = 'journal';

export type PhotoResult =
  | { ok: true; uris: string[] }
  | { ok: false; reason: string | null };

/**
 * Picks photos from the library and copies them into the app's own storage.
 *
 * The same reason as attachments: the picker hands back a URI into a cache the
 * OS may empty, so a journal photo saved today would be a grey box by the time
 * anyone looked back at the trip. Copying costs disk and buys the photo still
 * being there.
 */
export async function pickPhotos(limit = 8): Promise<PhotoResult> {
  let picked: ImagePicker.ImagePickerResult;
  try {
    picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: limit,
      // A journal photo is looked at on a phone, not printed. Full-resolution
      // originals would fill the device for no visible gain.
      quality: 0.8,
    });
  } catch (e) {
    console.warn('[documents] photo picker failed', e);
    return { ok: false, reason: "Couldn't open your photos." };
  }

  if (picked.canceled) return { ok: false, reason: null };
  const assets = picked.assets ?? [];
  if (assets.length === 0) return { ok: false, reason: 'No photos were picked.' };

  if (Platform.OS === 'web') {
    // Nothing persistent to copy into; the blob URIs are good for this session,
    // which is the honest limit of a browser here.
    return { ok: true, uris: assets.map((a) => a.uri) };
  }

  try {
    const dir = new Directory(Paths.document, PHOTO_FOLDER);
    dir.create({ intermediates: true, idempotent: true });

    const uris: string[] = [];
    for (const [i, asset] of assets.entries()) {
      const extension = asset.uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const target = new File(dir, `${Date.now()}-${i}.${extension.slice(0, 5)}`);
      await new File(asset.uri).copy(target);
      uris.push(target.uri);
    }
    return { ok: true, uris };
  } catch (e) {
    console.warn('[documents] photo copy failed', e);
    return { ok: false, reason: "Couldn't save those photos." };
  }
}

/** Same best-effort delete as attachments: a missing file is already gone. */
export const deletePhoto = deleteAttachment;
