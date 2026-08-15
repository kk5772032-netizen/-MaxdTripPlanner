import { Redirect } from 'expo-router';

/** The trip list is home. */
export default function Index() {
  return <Redirect href="/trips" />;
}
