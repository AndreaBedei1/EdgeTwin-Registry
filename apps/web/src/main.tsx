import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { QRCodeSVG } from "qrcode.react";
import {
  edgeRegistrationQrPayloadSchema,
  loginSchema,
  profileCreateSchema,
  registerFormSchema,
  type EdgeRegistrationQrPayload,
  type ProfileCreateInput
} from "@hdt/shared";
import { ZodError } from "zod";
import { api, type ApiError, type Profile, type User } from "./api";
import "./styles.css";

type View = "login" | "register" | "dashboard";
type FieldErrors = Record<string, string>;
type EdgeMode = "qr" | "manual";

const emptyProfile: ProfileCreateInput = {
  personalData: { firstName: "", lastName: "", phone: "", dateOfBirth: "" },
  hdtData: {
    name: "",
    sex: "prefer_not_to_say",
    drivingExperienceLevel: "beginner",
    drivingExperienceYears: "0_1",
    preferredDrivingStyle: "balanced",
    notes: ""
  },
  vdtData: {
    nickname: "",
    brand: "",
    model: "",
    vehicleType: "car",
    powertrain: "unknown",
    vehicleIdentifier: ""
  },
  edgeData: { edgeId: "", edgeName: "", edgeApiBaseUrl: "", source: "qr" }
};

const fallbackDevQrPayload = edgeRegistrationQrPayloadSchema.parse({
  type: "HDT_EDGE_REGISTRATION",
  version: 1,
  edgeId: "local-edge-01",
  edgeName: "Local Development Edge",
  edgeApiBaseUrl: "http://localhost:3000"
});

const sexOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Prefer not to say" }
] as const;

const experienceLevelOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "experienced", label: "Experienced" },
  { value: "professional", label: "Professional" }
] as const;

const experienceYearsOptions = [
  { value: "0_1", label: "0-1 years" },
  { value: "2_5", label: "2-5 years" },
  { value: "6_10", label: "6-10 years" },
  { value: "11_20", label: "11-20 years" },
  { value: "over_20", label: "Over 20 years" }
] as const;

const drivingStyleOptions = [
  { value: "cautious", label: "Cautious" },
  { value: "balanced", label: "Balanced" },
  { value: "dynamic", label: "Dynamic" },
  { value: "eco", label: "Eco" }
] as const;

const vehicleTypeOptions = [
  { value: "car", label: "Car" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "van", label: "Van" },
  { value: "truck", label: "Truck" },
  { value: "bus", label: "Bus" },
  { value: "prototype", label: "Prototype" },
  { value: "simulated_vehicle", label: "Simulated vehicle" }
] as const;

const powertrainOptions = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "hydrogen", label: "Hydrogen" },
  { value: "unknown", label: "Unknown" }
] as const;

function errorsFromZod(error: ZodError): FieldErrors {
  return Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
}

function errorsFromApi(error: ApiError): FieldErrors {
  return Object.fromEntries((error.details ?? []).filter((detail) => detail.field).map((detail) => [detail.field!, detail.message]));
}

function Field({
  id,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? <p className="field-error" id={errorId}>{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  error,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="field-error" id={errorId}>{error}</p> : null}
    </div>
  );
}

function TextArea({
  id,
  label,
  error,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; error?: string; hint?: string }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error ? <p className="field-error" id={errorId}>{error}</p> : null}
    </div>
  );
}

function AuthForm({ mode, onDone }: { mode: "login" | "register"; onDone: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setErrors({});

    const parsed =
      mode === "login"
        ? loginSchema.safeParse({ email, password })
        : registerFormSchema.safeParse({ email, password, confirmPassword });

    if (!parsed.success) {
      setErrors(errorsFromZod(parsed.error));
      return;
    }

    setIsLoading(true);
    try {
      const authInput = { email: parsed.data.email, password: parsed.data.password };
      const result = mode === "login" ? await api.login(authInput) : await api.register(authInput);
      onDone(result.user);
    } catch (err) {
      const apiError = err as ApiError;
      setMessage(apiError.message);
      setErrors(errorsFromApi(apiError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit} noValidate aria-busy={isLoading}>
      <div className="card-heading">
        <p className="eyebrow">{mode === "login" ? "Secure access" : "New profile"}</p>
        <h2>{mode === "login" ? "Log in" : "Create account"}</h2>
      </div>
      <Field
        id={`${mode}-email`}
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={errors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        id={`${mode}-password`}
        label="Password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={password}
        error={errors.password}
        hint={mode === "register" ? "Use at least 12 characters." : undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      {mode === "register" ? (
        <Field
          id="register-confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      ) : null}
      {message ? (
        <p className="form-message error" role="alert" aria-live="assertive">
          {message}
        </p>
      ) : null}
      <button className="primary-button" type="submit" disabled={isLoading}>
        {isLoading ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
      </button>
    </form>
  );
}

function parseQrPayload(rawValue: string) {
  let json: unknown;
  try {
    json = JSON.parse(rawValue);
  } catch {
    return { ok: false as const, message: "The QR code is not valid JSON." };
  }

  const parsed = edgeRegistrationQrPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false as const, message: "The QR code is not a valid HDT edge registration payload." };
  }

  return {
    ok: true as const,
    edgeData: {
      edgeId: parsed.data.edgeId,
      edgeName: parsed.data.edgeName ?? "",
      edgeApiBaseUrl: parsed.data.edgeApiBaseUrl,
      source: "qr" as const
    }
  };
}

function DevelopmentQrHelper() {
  const [payload, setPayload] = useState<EdgeRegistrationQrPayload>(fallbackDevQrPayload);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    api
      .edgeRegistrationPayload()
      .then((result) => {
        const parsed = edgeRegistrationQrPayloadSchema.safeParse(result);
        if (!parsed.success) {
          throw new Error("The backend returned an invalid edge registration payload.");
        }
        if (!cancelled) {
          setPayload(parsed.data);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPayload(fallbackDevQrPayload);
          setError("Unable to load the edge registration payload from the backend. Showing a safe local fallback.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="dev-qr-helper" aria-label="Development QR helper">
      <p className="eyebrow">Development only</p>
      <QRCodeSVG value={JSON.stringify(payload)} size={132} />
      <p>Use this QR code to test local edge registration.</p>
      {error ? <p className="form-message error" role="status" aria-live="polite">{error}</p> : null}
    </div>
  );
}

function EdgeQrScanner({ onScanned }: { onScanned: (edgeData: ProfileCreateInput["edgeData"]) => void }) {
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");

  function onScan(codes: IDetectedBarcode[]) {
    const rawValue = codes[0]?.rawValue;
    if (!rawValue) {
      return;
    }

    const parsed = parseQrPayload(rawValue);
    setScannerActive(false);
    if (!parsed.ok) {
      setScannerError(parsed.message);
      setScannerMessage("");
      return;
    }

    setScannerError("");
    setScannerMessage("Edge node data captured from QR code.");
    onScanned(parsed.edgeData);
  }

  return (
    <div className="qr-box">
      <p id="qr-description">Scan the QR code shown by your edge node to connect this profile to the correct personal edge.</p>
      <div className="qr-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setScannerError("");
            setScannerMessage("");
            setScannerActive(true);
          }}
          disabled={scannerActive}
        >
          {scannerActive ? "Scanner active" : "Start QR scanner"}
        </button>
        {scannerActive ? (
          <button className="ghost-button" type="button" onClick={() => setScannerActive(false)}>
            Cancel scan
          </button>
        ) : null}
      </div>
      {scannerActive ? (
        <div className="scanner-frame" aria-label="Camera preview for QR code scanning">
          <Scanner
            onScan={onScan}
            onError={(error) => {
              const message = error instanceof Error ? error.message : "Unable to access the camera.";
              setScannerError(message);
              setScannerActive(false);
            }}
            constraints={{ facingMode: "environment" }}
            scanDelay={500}
            allowMultiple={false}
            sound={false}
          />
        </div>
      ) : (
        <div className="scanner-placeholder" aria-describedby="qr-description">
          Camera starts only after you press the scanner button.
        </div>
      )}
      {scannerError ? <p className="form-message error" role="alert" aria-live="assertive">{scannerError}</p> : null}
      {scannerMessage ? <p className="form-message success" role="status" aria-live="polite">{scannerMessage}</p> : null}
      {import.meta.env.DEV ? <DevelopmentQrHelper /> : null}
    </div>
  );
}

function EdgeModeToggle({ value, onChange }: { value: EdgeMode; onChange: (value: EdgeMode) => void }) {
  return (
    <fieldset className="segmented-fieldset">
      <legend>Edge registration mode</legend>
      <div className="segmented-control">
        <label className={value === "qr" ? "selected" : ""}>
          <input type="radio" name="edge-mode" value="qr" checked={value === "qr"} onChange={() => onChange("qr")} />
          Scan QR code
        </label>
        <label className={value === "manual" ? "selected" : ""}>
          <input type="radio" name="edge-mode" value="manual" checked={value === "manual"} onChange={() => onChange("manual")} />
          Enter manually
        </label>
      </div>
    </fieldset>
  );
}

function ProfileForm({
  editingProfile,
  onSaved,
  onCancelEdit
}: {
  editingProfile: Profile | null;
  onSaved: (profile: Profile) => void;
  onCancelEdit: () => void;
}) {
  const [form, setForm] = useState<ProfileCreateInput>(emptyProfile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>("qr");

  useEffect(() => {
    if (!editingProfile) {
      return;
    }
    const edgeSource = editingProfile.edgeData.source === "qr" ? "qr" : "manual";
    setForm({
      personalData: editingProfile.personalData,
      hdtData: editingProfile.hdtData,
      vdtData: editingProfile.vdtData,
      edgeData: { ...editingProfile.edgeData, source: edgeSource }
    });
    setEdgeMode(edgeSource);
    setMessage("");
    setErrors({});
  }, [editingProfile]);

  function setValue(section: keyof ProfileCreateInput, key: string, value: string) {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value }
    }));
  }

  function onEdgeModeChange(nextMode: EdgeMode) {
    setEdgeMode(nextMode);
    setForm((current) => ({
      ...current,
      edgeData: { ...current.edgeData, source: nextMode }
    }));
    setErrors({});
    setMessage("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setErrors({});

    const formForSubmit: ProfileCreateInput = {
      ...form,
      edgeData: { ...form.edgeData, source: edgeMode }
    };
    const parsed = profileCreateSchema.safeParse(formForSubmit);
    if (!parsed.success) {
      setErrors(errorsFromZod(parsed.error));
      return;
    }

    setIsLoading(true);
    try {
      const result = editingProfile
        ? await api.updateProfile(editingProfile._id, parsed.data)
        : await api.createProfile(parsed.data);
      onSaved(result.profile);
      if (!editingProfile) {
        setForm(emptyProfile);
        setEdgeMode("qr");
      }
      setMessage(editingProfile ? "Profile updated." : "Profile saved and mock HDT deployment started.");
    } catch (err) {
      const apiError = err as ApiError;
      setMessage(apiError.message);
      setErrors(errorsFromApi(apiError));
    } finally {
      setIsLoading(false);
    }
  }

  const edgeErrors = [errors["edgeData.edgeId"], errors["edgeData.edgeApiBaseUrl"]].filter(Boolean);

  return (
    <form className="panel profile-form" onSubmit={onSubmit} noValidate aria-busy={isLoading}>
      <div className="card-heading">
        <p className="eyebrow">Profile setup</p>
        <h2>{editingProfile ? "Edit profile" : "Register profile"}</h2>
      </div>

      <section aria-labelledby="personal-heading">
        <h3 id="personal-heading">Personal profile</h3>
        <Field id="firstName" label="First name" value={form.personalData.firstName} error={errors["personalData.firstName"]} onChange={(e) => setValue("personalData", "firstName", e.target.value)} />
        <Field id="lastName" label="Last name" value={form.personalData.lastName} error={errors["personalData.lastName"]} onChange={(e) => setValue("personalData", "lastName", e.target.value)} />
        <Field id="phone" label="Phone" type="tel" value={form.personalData.phone} error={errors["personalData.phone"]} onChange={(e) => setValue("personalData", "phone", e.target.value)} />
        <Field id="dateOfBirth" label="Date of birth" type="date" value={form.personalData.dateOfBirth} error={errors["personalData.dateOfBirth"]} onChange={(e) => setValue("personalData", "dateOfBirth", e.target.value)} />
      </section>

      <section aria-labelledby="hdt-heading">
        <h3 id="hdt-heading">Human Digital Twin</h3>
        <Field id="hdtName" label="HDT name" value={form.hdtData.name} error={errors["hdtData.name"]} hint="Example: Andrea HDT" onChange={(e) => setValue("hdtData", "name", e.target.value)} />
        <SelectField id="hdtSex" label="Sex" value={form.hdtData.sex} options={sexOptions} error={errors["hdtData.sex"]} onChange={(e) => setValue("hdtData", "sex", e.target.value)} />
        <SelectField id="experienceLevel" label="Driving experience level" value={form.hdtData.drivingExperienceLevel} options={experienceLevelOptions} error={errors["hdtData.drivingExperienceLevel"]} onChange={(e) => setValue("hdtData", "drivingExperienceLevel", e.target.value)} />
        <SelectField id="experienceYears" label="Driving experience years" value={form.hdtData.drivingExperienceYears} options={experienceYearsOptions} error={errors["hdtData.drivingExperienceYears"]} onChange={(e) => setValue("hdtData", "drivingExperienceYears", e.target.value)} />
        <SelectField id="drivingStyle" label="Preferred driving style" value={form.hdtData.preferredDrivingStyle} options={drivingStyleOptions} error={errors["hdtData.preferredDrivingStyle"]} onChange={(e) => setValue("hdtData", "preferredDrivingStyle", e.target.value)} />
        <TextArea
          id="hdtNotes"
          label="Notes"
          value={form.hdtData.notes}
          error={errors["hdtData.notes"]}
          hint="Do not enter medical, clinical, or sensitive personal information."
          onChange={(e) => setValue("hdtData", "notes", e.target.value)}
        />
      </section>

      <section aria-labelledby="vdt-heading">
        <h3 id="vdt-heading">Vehicle Digital Twin</h3>
        <Field id="vehicleNickname" label="Vehicle nickname" value={form.vdtData.nickname} error={errors["vdtData.nickname"]} hint="Example: Test Vehicle 01" onChange={(e) => setValue("vdtData", "nickname", e.target.value)} />
        <Field id="vehicleBrand" label="Brand" value={form.vdtData.brand} error={errors["vdtData.brand"]} hint="Example: Toyota" onChange={(e) => setValue("vdtData", "brand", e.target.value)} />
        <Field id="vehicleModel" label="Model" value={form.vdtData.model} error={errors["vdtData.model"]} hint="Example: Yaris" onChange={(e) => setValue("vdtData", "model", e.target.value)} />
        <SelectField id="vehicleType" label="Vehicle type" value={form.vdtData.vehicleType} options={vehicleTypeOptions} error={errors["vdtData.vehicleType"]} onChange={(e) => setValue("vdtData", "vehicleType", e.target.value)} />
        <SelectField id="powertrain" label="Powertrain" value={form.vdtData.powertrain} options={powertrainOptions} error={errors["vdtData.powertrain"]} onChange={(e) => setValue("vdtData", "powertrain", e.target.value)} />
        <Field id="vehicleIdentifier" label="Vehicle identifier" value={form.vdtData.vehicleIdentifier} error={errors["vdtData.vehicleIdentifier"]} hint="Optional internal identifier. It does not have to be a license plate." onChange={(e) => setValue("vdtData", "vehicleIdentifier", e.target.value)} />
      </section>

      <section aria-labelledby="edge-heading">
        <h3 id="edge-heading">Edge node</h3>
        <EdgeModeToggle value={edgeMode} onChange={onEdgeModeChange} />
        {edgeMode === "qr" ? (
          <>
            <EdgeQrScanner
              onScanned={(edgeData) => {
                setForm((current) => ({ ...current, edgeData }));
                setErrors({});
              }}
            />
            {form.edgeData.edgeId ? (
              <div className="edge-summary" aria-live="polite">
                <strong>Selected edge:</strong>
                <span>{form.edgeData.edgeName || form.edgeData.edgeId}</span>
                <span>{form.edgeData.edgeApiBaseUrl}</span>
              </div>
            ) : null}
            {edgeErrors.length > 0 ? (
              <p className="form-message error" role="alert">
                Scan a valid edge QR code or switch to manual entry before saving.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <Field id="edgeId" label="Edge ID" value={form.edgeData.edgeId} error={errors["edgeData.edgeId"]} onChange={(e) => setValue("edgeData", "edgeId", e.target.value)} />
            <Field id="edgeName" label="Edge name" value={form.edgeData.edgeName} error={errors["edgeData.edgeName"]} onChange={(e) => setValue("edgeData", "edgeName", e.target.value)} />
            <Field id="edgeApiBaseUrl" label="Edge API base URL" type="url" value={form.edgeData.edgeApiBaseUrl} error={errors["edgeData.edgeApiBaseUrl"]} hint="Local HTTP URLs are allowed for development. Prefer HTTPS in production." onChange={(e) => setValue("edgeData", "edgeApiBaseUrl", e.target.value)} />
          </>
        )}
      </section>

      {message ? (
        <p className={message.includes("saved") || message.includes("updated") ? "form-message success" : "form-message error"} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
      <button className="primary-button" type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : editingProfile ? "Update profile" : "Save profile and deploy HDT"}
      </button>
      {editingProfile ? (
        <button className="secondary-button full-width" type="button" onClick={onCancelEdit}>
          Cancel edit
        </button>
      ) : null}
    </form>
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .profiles()
      .then((result) => setProfiles(result.profiles))
      .catch((err: ApiError) => setMessage(err.message));
  }, []);

  return (
    <main className="layout">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Signed in</p>
          <h1>{user.email}</h1>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>
          Log out
        </button>
      </header>
      {message ? (
        <p className="form-message error" role="alert" aria-live="assertive">
          {message}
        </p>
      ) : null}
      <ProfileForm
        editingProfile={editingProfile}
        onCancelEdit={() => setEditingProfile(null)}
        onSaved={(profile) => {
          setProfiles((current) => {
            const exists = current.some((item) => item._id === profile._id);
            return exists ? current.map((item) => (item._id === profile._id ? profile : item)) : [profile, ...current];
          });
          setEditingProfile(null);
        }}
      />
      <section className="panel" aria-labelledby="profiles-heading">
        <div className="card-heading">
          <p className="eyebrow">Saved profiles</p>
          <h2 id="profiles-heading">Your profiles</h2>
        </div>
        {profiles.length === 0 ? <p>No profiles registered yet.</p> : null}
        <div className="profile-list">
          {profiles.map((profile) => (
            <article className="profile-card" key={profile._id}>
              <h3>{profile.hdtData.name}</h3>
              <p>{profile.personalData.firstName} {profile.personalData.lastName}</p>
              <dl>
                <div><dt>Vehicle</dt><dd>{profile.vdtData.brand} {profile.vdtData.model}</dd></div>
                <div><dt>Type</dt><dd>{profile.vdtData.vehicleType}</dd></div>
                <div><dt>Edge</dt><dd>{profile.edgeData.edgeName || profile.edgeData.edgeId}</dd></div>
                <div><dt>Deployment</dt><dd>{profile.deployment.status}</dd></div>
                <div><dt>Pod</dt><dd>{profile.deployment.podName ?? "Pending"}</dd></div>
              </dl>
              <button className="secondary-button full-width" type="button" onClick={() => setEditingProfile(profile)}>
                Edit profile
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("login");
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((result) => {
        setUser(result.user);
        setView("dashboard");
      })
      .catch(() => undefined)
      .finally(() => setIsBooting(false));
  }, []);

  const authMode = useMemo(() => (view === "register" ? "register" : "login"), [view]);

  async function logout() {
    await api.logout();
    setUser(null);
    setView("login");
  }

  if (isBooting) {
    return <main className="layout"><p className="panel">Loading session...</p></main>;
  }

  if (user && view === "dashboard") {
    return <Dashboard user={user} onLogout={logout} />;
  }

  return (
    <main className="auth-layout">
      <section className="auth-hero" aria-labelledby="auth-title">
        <p className="eyebrow">Human Digital Twins</p>
        <h1 id="auth-title">HDT Registry</h1>
        <p>Securely register people, digital twins, vehicles, and local edge nodes from a mobile-first workflow.</p>
      </section>
      <div className="auth-shell">
        <div className="tabs" role="tablist" aria-label="Authentication">
          <button className={view === "login" ? "active" : ""} type="button" role="tab" aria-selected={view === "login"} onClick={() => setView("login")}>
            Login
          </button>
          <button className={view === "register" ? "active" : ""} type="button" role="tab" aria-selected={view === "register"} onClick={() => setView("register")}>
            Register
          </button>
        </div>
        <AuthForm mode={authMode} onDone={(nextUser) => { setUser(nextUser); setView("dashboard"); }} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
