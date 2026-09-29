"use client";

import React from "react";
import { Table, type TableProps, Text, Box } from "@mantine/core";
import classes from "./responsive-table.module.css";

export interface ResponsiveTableColumn<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string | number;
  className?: string;
  hideOnMobile?: boolean;
  mobileLabel?: string;
}

export interface ResponsiveTableProps<T> extends Omit<TableProps, "data"> {
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  columns?: ResponsiveTableColumn<T>[];
  renderRow?: (item: T, index: number) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
  desktopClassName?: string;
  mobileClassName?: string;
  cardClassName?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  keyExtractor = (item, idx) => (item?.id !== undefined ? String(item.id) : idx),
  columns,
  renderRow,
  renderHeader,
  renderMobileCard,
  emptyState,
  className,
  desktopClassName,
  mobileClassName,
  cardClassName,
  ...tableProps
}: ResponsiveTableProps<T>) {
  if (!data || data.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={`${classes.container} ${className ?? ""}`}>
      {/* Desktop Table View */}
      <Table
        verticalSpacing="sm"
        horizontalSpacing="md"
        {...tableProps}
        className={`${classes.desktopView} ${desktopClassName ?? ""}`}
      >
        {renderHeader ? (
          <Table.Thead>{renderHeader()}</Table.Thead>
        ) : columns ? (
          <Table.Thead>
            <Table.Tr>
              {columns.map((col, idx) => (
                <Table.Th
                  key={idx}
                  style={{
                    textAlign: col.align || "left",
                    width: col.width,
                  }}
                  className={col.className}
                >
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
        ) : null}

        <Table.Tbody>
          {data.map((item, idx) => {
            const rowKey = keyExtractor(item, idx);

            if (renderRow) {
              return <React.Fragment key={rowKey}>{renderRow(item, idx)}</React.Fragment>;
            }

            if (columns) {
              return (
                <Table.Tr key={rowKey}>
                  {columns.map((col, cIdx) => (
                    <Table.Td
                      key={cIdx}
                      style={{ textAlign: col.align || "left" }}
                      className={col.className}
                    >
                      {col.render
                        ? col.render(item, idx)
                        : col.accessorKey
                          ? String(item[col.accessorKey] ?? "-")
                          : null}
                    </Table.Td>
                  ))}
                </Table.Tr>
              );
            }

            return null;
          })}
        </Table.Tbody>
      </Table>

      {/* Mobile & Tablet Card List View */}
      <div className={`${classes.mobileView} ${mobileClassName ?? ""}`}>
        {data.map((item, idx) => {
          const itemKey = keyExtractor(item, idx);

          if (renderMobileCard) {
            return (
              <React.Fragment key={itemKey}>
                {renderMobileCard(item, idx)}
              </React.Fragment>
            );
          }

          // Fallback automatic card rendering if columns are defined
          if (columns) {
            const visibleCols = columns.filter((col) => !col.hideOnMobile);
            return (
              <div key={itemKey} className={`${classes.defaultCard} ${cardClassName ?? ""}`}>
                {visibleCols.map((col, cIdx) => {
                  const label =
                    col.mobileLabel ??
                    (typeof col.header === "string" ? col.header : `Item ${cIdx + 1}`);
                  const value = col.render
                    ? col.render(item, idx)
                    : col.accessorKey
                      ? String(item[col.accessorKey] ?? "-")
                      : "-";

                  return (
                    <div key={cIdx} className={classes.cardRow}>
                      <Text className={classes.cardLabel}>{label}</Text>
                      <Box className={classes.cardValue}>{value}</Box>
                    </div>
                  );
                })}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
