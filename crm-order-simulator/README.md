# CRM Order Simulator

A practice environment for onboarding training. New users can learn to **create an order, add products and submit it** in a screen layout like the one they'll use at work, without touching the live CRM.

It is a plain static web app with no server, login or database. All data stays in the trainee's own browser (localStorage).

## Running it

- **Locally:** open `index.html` in any modern browser.
- **For a class:** host the folder on any static web host (GitHub Pages, SharePoint, an internal web server, etc.) and share the link.

Each trainee gets their own private sandbox. **Reset sandbox data** in the yellow banner clears it.

## What trainees practice

1. **Create an order:** choose the account (lookup search), start date, order type, PO number and addresses. The order is saved as **Draft**.
2. **Add products:** pick items from the price book, then set the quantity and discount. Lines can be edited and deleted.
3. **Submit:** the app checks the order against business rules. It then either activates the order automatically or sends it for manager approval. The trainee can approve or reject it with the simulate buttons.

The status path is **Draft → Submitted → Activated**. A rejected order goes back to Draft with the manager's comment.

Also included:
- **Onboarding checklist** on the Home page that ticks off steps automatically (9 steps)
- **Training Guide** tab with step-by-step instructions and 5 practice scenarios
- Step-by-step tips on screen, validation messages, toasts and an activity history on every order

## Business rules (built in)

| Rule | Where it's enforced |
|---|---|
| Orders only for **Active** accounts | Create & submit |
| Start date can't be in the past | Create & submit |
| Billing address required | Create |
| PO number (letters/numbers/dashes), shipping address and ≥1 product required | Submit |
| Quantity must be a whole number ≥ 1; discount 0–50% | Order products |
| Order total > `$10,000` or any discount > `20%` → manager approval | Submit |
| Submitted / Activated orders are locked | Order page |

## Customising for your company

Edit `data.js`:
- `accounts`: sample customers. Leave `shipping` blank or set `status` to something other than `Active` to create practice error cases.
- `products`: price book items. `active: false` hides an item from Add Products.
- `approvalThreshold` and `maxDiscount`: approval rules.

To change the validation rules, edit `saveOrderHeader()` (when the order is created) and `submitValidation()` (when it is submitted) in `app.js`.

## Files

- `index.html`: page shell
- `styles.css`: styling (works on desktop and mobile)
- `data.js`: sample data and rule settings
- `app.js`: application logic
