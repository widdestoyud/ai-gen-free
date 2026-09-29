"use client";

import { Container, Stack, Title, Text, Paper, Button, Group, Divider, Badge, List } from "@mantine/core";
import Link from "next/link";

export function PrivacyPageView() {
  return (
    <Container size="md" py={60}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Button
            component={Link}
            href="/"
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            }
          >
            Back to Home
          </Button>
          <Badge variant="outline" color="teal">
            Last updated: September 2026
          </Badge>
        </Group>

        <div>
          <Title order={1} fz={{ base: "1.8rem", sm: "2.4rem" }} fw={900} mb="xs">
            Privacy Policy
          </Title>
          <Text c="dimmed" size="sm">
            Your privacy and data confidentiality are top priorities at{" "}
            <strong style={{ color: "#60a5fa" }}>satulabs.id</strong>. This policy explains how we collect, use, and safeguard your personal information.
          </Text>
        </div>

        <Divider />

        <Paper p="xl" withBorder radius="md" bg="var(--mantine-color-dark-8, #14171f)">
          <Stack gap="xl">
            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                1. Information We Collect
              </Title>
              <Stack gap="md" mt="xs">
                <div>
                  <Text fw={600} size="sm" c="gray.2" mb="xs">
                    1.1. Personal Information
                  </Text>
                  <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                    When you interact with us, we may collect personal information, including but not limited to:
                  </Text>
                  <List spacing="xs" size="sm" c="gray.3" pl="md">
                    <List.Item>Name</List.Item>
                    <List.Item>Email address</List.Item>
                    <List.Item>Phone number</List.Item>
                    <List.Item>Company name</List.Item>
                    <List.Item>Payment details (for services)</List.Item>
                    <List.Item>Any other information you provide when contacting us or signing up for services</List.Item>
                  </List>
                </div>

                <div>
                  <Text fw={600} size="sm" c="gray.2" mb="xs">
                    1.2. Automatically Collected Information
                  </Text>
                  <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                    When you visit our website, we may automatically collect:
                  </Text>
                  <List spacing="xs" size="sm" c="gray.3" pl="md">
                    <List.Item>IP address</List.Item>
                    <List.Item>Browser type and version</List.Item>
                    <List.Item>Pages you visit and the time spent on them</List.Item>
                    <List.Item>Device type and operating system</List.Item>
                    <List.Item>Cookies and tracking data</List.Item>
                  </List>
                </div>

                <div>
                  <Text fw={600} size="sm" c="gray.2" mb="xs">
                    1.3. Information from Third Parties
                  </Text>
                  <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                    We may receive information from:
                  </Text>
                  <List spacing="xs" size="sm" c="gray.3" pl="md">
                    <List.Item>Social media platforms (if you interact with our pages)</List.Item>
                    <List.Item>Analytics providers (Google Analytics, etc.)</List.Item>
                    <List.Item>Payment processors</List.Item>
                  </List>
                </div>
              </Stack>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                2. How We Use Your Information
              </Title>
              <Text size="sm" c="gray.3" lh={1.6} mb="xs">
                We use the collected information to:
              </Text>
              <List spacing="xs" size="sm" c="gray.3" pl="md">
                <List.Item>Provide, operate, and improve our services</List.Item>
                <List.Item>Process transactions and send invoices</List.Item>
                <List.Item>Respond to inquiries and customer support requests</List.Item>
                <List.Item>Send marketing and promotional materials (you can opt-out anytime)</List.Item>
                <List.Item>Detect and prevent fraudulent activities</List.Item>
                <List.Item>
                  Detect, investigate, prevent, and enforce violations of our Terms, Content Policy, fraud, abuse, trust and safety risks, and legal/compliance issues
                </List.Item>
                <List.Item>Comply with legal obligations</List.Item>
              </List>
              <Text size="sm" c="gray.2" fw={600} mt="sm">
                We do not sell your personal data to third parties.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                3. Media Retention &amp; Storage Lifecycle (14-Day Storage)
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Generated media files (images and videos) and uploaded inputs are stored in encrypted cloud storage with a retention lifecycle (<em>Time-to-Live</em>) of up to <strong>14 (fourteen) days</strong>. After 14 days, files are automatically and permanently deleted from our servers for storage efficiency and data privacy. Users are encouraged to download and back up their media to their own devices before this period expires.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                4. Service Providers
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                We may share data with third-party vendors who help us run our business (e.g., payment processors, cloud hosting, analytics providers).
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                5. Security &amp; Encryption
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                We apply strict technical and operational security measures: encrypted HTTPS/TLS communication protocols, one-way cryptographic password and token hashing, and single active session controls per account to protect against unauthorized access and session hijacking.
              </Text>
            </section>
          </Stack>
        </Paper>

        <Group justify="center" mt="md">
          <Button
            component={Link}
            href="/"
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            size="md"
          >
            I Understand &amp; Back to Home
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
