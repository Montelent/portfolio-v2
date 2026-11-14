# Admin access and Firebase setup

This portfolio uses a Firestore admin allowlist. A person may have a normal Firebase Authentication account, but **only users explicitly added to the Firestore `admins` collection can access the Admin Dashboard or modify portfolio data**.

This supports multiple administrators, works when the project is forked, and requires no custom claims, Firebase Admin SDK credentials, hard-coded email addresses, or UID values in frontend code.

## 1. Create an Authentication user

In Firebase Console, open **Authentication → Users → Add user** and create an account with an email and password.

Make sure Email/Password is enabled under **Authentication → Sign-in method**.

## 2. Add the user to the admin allowlist

1. Copy the user's UID from **Authentication → Users**.
2. Open **Firestore Database → Data**.
3. Create a collection named `admins` if it does not exist.
4. Create a document whose **document ID is exactly the user's Firebase Authentication UID**.
5. Add this field:

| Field | Type | Value |
|---|---|---|
| `enabled` | boolean | `true` |

The structure should look like:

```
admins
  └── FIREBASE_AUTH_UID
       └── enabled: true
```

Repeat for every person who should administer the portfolio. To revoke access, set `enabled` to `false` or delete that admin document.

## 3. Deploy Firestore rules

From the project directory, confirm that the Firebase CLI is targeting the correct Firebase project, then run:

```sh
firebase deploy --only firestore:rules
```

The rules allow a signed-in user to read only their own admin record. They prevent all client-side creation, editing, or deletion of admin records. Portfolio writes require an enabled allowlist record.

## 4. Sign in

Open the portfolio Admin login page and sign in using the email and password created in Firebase Authentication. No custom claim or token setup is needed.

## Forking this project

When forking this repository, use your own Firebase project:

1. Create or select your Firebase project.
2. Configure the app's Firebase environment variables for that project.
3. Deploy the included Firestore rules.
4. Create your own Firebase Authentication user(s).
5. Add each authorised user's UID to your own Firestore `admins` collection with `enabled: true`.

No original owner's UID, email, or secret is embedded in the source code.

## Security notes

- Do not enable public account registration unless you intend to offer public accounts. Even if registration is enabled, newly registered users do not become admins unless you add their UID to the `admins` collection.
- Admin records must be provisioned through the Firebase Console or another trusted administrative environment, never by the public frontend.
- Never expose Firebase Admin SDK credentials in frontend code or `VITE_*` environment variables.
- Firebase web configuration values are client-side identifiers; Firestore Security Rules are the authorization boundary.
- Cloudinary upload presets must also enforce allowed formats, file-size limits, and unsigned-upload restrictions in the Cloudinary dashboard. Browser-side checks improve feedback but are not a security boundary.
