# Zolofy Agentic — Design System

All UI in this project MUST follow these rules. No exceptions.

## Typography (SF Pro equivalent = Inter)

- Page titles / key amounts: **28–32px, semibold**
- Section headers: **17–20px, medium**
- Body rows and labels: **15–17px, regular**
- Captions and hints: **13–15px, regular**

## Colors

| Token           | Value     |
| --------------- | --------- |
| Background      | `#F2F2F7` |
| Card surfaces   | `#FFFFFF` |
| Primary accent  | `#007AFF` |
| Error           | `#FF3B30` |
| Primary text    | `#000000` |
| Secondary text  | `#6C6C70` |
| Separator       | `#E5E5EA` |

## Spacing (8pt grid)

- Layout margins: **16–20px** from edges
- Intra-row spacing: **8px**
- Between rows: **16–20px**
- Between sections: **24–32px**
- Minimum tap target: **44×44px**

## Shapes

- Large cards: **border-radius 16–20px**
- Buttons: **border-radius 10–12px**
- Pills / chips: **border-radius 8px**

## Motion

- Sheet transitions: **200–250ms ease-out**
- Micro feedback (button press): **80–150ms**
- **No bouncy or playful animations on money moments**

## Glassmorphism

- Floating panels: white at **85% opacity**, **backdrop-blur 20px**, subtle box-shadow.

## Layout

- **Left panel (30% width):** product catalog — minimal cards with product name, category pill, base price. **No formula shown.**
- **Right panel (70% width):** Zolly chat interface — full height, white background, messages in bubbles.
- **When Zolly triggers configuration:** inline card appears in chat with variable inputs.
- **Mandate moment:** Apple Pay-style bottom sheet slides up with **250ms ease-out**, shows item, final price, validity countdown, Pay button.

## Jobs Rules

1. **Never show more than one primary action at a time.**
2. **No borders inside cards** — use spacing and background color to separate.
3. **The price is always the most prominent element when visible.**
4. **Every unnecessary element is a failure.**
