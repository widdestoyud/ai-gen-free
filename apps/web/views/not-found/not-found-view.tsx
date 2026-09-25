"use client";

import Link from "next/link";
import { Box, Title, Text } from "@mantine/core";
import classes from "./not-found-view.module.css";

export function NotFoundView() {
  return (
    <Box className={classes.wrapper}>
      <Text className={classes.code}>404</Text>
      <Title order={1} className={classes.title}>
        Page not found
      </Title>
      <Text className={classes.description}>
        The page may have been moved or no longer exists.
      </Text>
      <Link href="/" className={classes.returnLink}>
        Return home
      </Link>
    </Box>
  );
}
