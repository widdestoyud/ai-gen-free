import { Title } from "@mantine/core";
import { OrderClient } from "./components/order-client";
import type { Invoice, Package } from "./types";

export function OrderPageView({
  data,
}: {
  data: {
    packages: Package[];
    invoices: Invoice[];
  };
}) {
  return (
    <>
      <Title order={2} mb="md">
        Order Poin
      </Title>
      <OrderClient
        packages={data.packages}
        invoices={data.invoices}
      />
    </>
  );
}
