import { createTheme, Modal, Drawer, Overlay, Button } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  defaultGradient: { from: "#3b82f6", to: "#8b5cf6", deg: 135 },
  fontFamily: "system-ui, sans-serif",
  headings: { fontFamily: "system-ui, sans-serif", fontWeight: "600" },
  components: {
    Button: Button.extend({
      defaultProps: {
        variant: "gradient",
        gradient: { from: "#3b82f6", to: "#8b5cf6", deg: 135 },
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        overlayProps: {
          backgroundOpacity: 0.65,
          blur: 8,
        },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        overlayProps: {
          backgroundOpacity: 0.65,
          blur: 8,
        },
      },
    }),
    Overlay: Overlay.extend({
      defaultProps: {
        backgroundOpacity: 0.65,
        blur: 8,
      },
    }),
  },
});
