import { Center, Loader } from "@mantine/core";

export default function AppLoading() {
  return (
    <Center h={320}>
      <Loader color="blue" size="md" />
    </Center>
  );
}
