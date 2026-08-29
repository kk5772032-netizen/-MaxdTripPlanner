import { openTestDb, setDbForTesting } from '../client';
import * as journalRepo from './journal';
import * as tripsRepo from './trips';

describe('the journal', () => {
  let tripId: string;

  beforeEach(async () => {
    setDbForTesting(await openTestDb());
    const trip = await tripsRepo.createTrip({
      name: 'Delhi', startDate: '2026-11-09', endDate: '2026-11-11',
      currency: 'INR', totalBudgetMinor: null,
    });
    tripId = trip.id;
  });

  afterEach(() => setDbForTesting(null));

  it('starts with nothing, and does not invent empty days', async () => {
    expect(await journalRepo.listJournal(tripId)).toEqual([]);
  });

  it('keeps one entry per day however many times it is asked for', async () => {
    // Two photos added in quick succession must not race into two rows: the
    // unique constraint would turn that into an error the user sees.
    const a = await journalRepo.entryForDay(tripId, '2026-11-09');
    const b = await journalRepo.entryForDay(tripId, '2026-11-09');
    expect(b.id).toBe(a.id);
  });

  it('holds a note against the day it belongs to', async () => {
    await journalRepo.setNote(tripId, '2026-11-09', 'Rained all afternoon');
    const [entry] = await journalRepo.listJournal(tripId);
    expect(entry.dayDate).toBe('2026-11-09');
    expect(entry.note).toBe('Rained all afternoon');
  });

  it('attaches photos in the order they were added', async () => {
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg', 'file://b.jpg']);
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://c.jpg']);
    const [entry] = await journalRepo.listJournal(tripId);
    expect(entry.photos.map((p) => p.uri)).toEqual([
      'file://a.jpg', 'file://b.jpg', 'file://c.jpg',
    ]);
  });

  it('returns the file path when a photo is removed, so the file can go too', async () => {
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);
    const [entry] = await journalRepo.listJournal(tripId);
    const uri = await journalRepo.removePhoto(entry.photos[0].id);
    expect(uri).toBe('file://a.jpg');
  });

  it('clears up after itself when the last thing is removed', async () => {
    // Adding a photo and taking it away again should leave no trace, rather
    // than a blank diary page nobody asked for.
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);
    const [entry] = await journalRepo.listJournal(tripId);
    await journalRepo.removePhoto(entry.photos[0].id);
    expect(await journalRepo.listJournal(tripId)).toEqual([]);
  });

  it('keeps the entry while a note or a photo survives', async () => {
    await journalRepo.setNote(tripId, '2026-11-09', 'Good day');
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);
    const [entry] = await journalRepo.listJournal(tripId);

    await journalRepo.removePhoto(entry.photos[0].id);
    expect(await journalRepo.listJournal(tripId)).toHaveLength(1);

    await journalRepo.setNote(tripId, '2026-11-09', '   ');
    expect(await journalRepo.listJournal(tripId)).toEqual([]);
  });

  it('orders days oldest first', async () => {
    await journalRepo.setNote(tripId, '2026-11-11', 'Last');
    await journalRepo.setNote(tripId, '2026-11-09', 'First');
    expect((await journalRepo.listJournal(tripId)).map((e) => e.note)).toEqual([
      'First', 'Last',
    ]);
  });

  it('goes when the trip goes', async () => {
    await journalRepo.setNote(tripId, '2026-11-09', 'Something');
    await journalRepo.addPhotos(tripId, '2026-11-09', ['file://a.jpg']);
    await tripsRepo.deleteTrip(tripId);
    expect(await journalRepo.listJournal(tripId)).toEqual([]);
  });
});
