import { Redirect } from "expo-router";

export default function Index() {
  // стартовый экран приложения
  return <Redirect href="/attendance" />;
}