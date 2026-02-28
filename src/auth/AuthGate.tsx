import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AppLayout } from "../app/AppLayout";
import { tauriInvoke } from "../tauri/api";

type AuthMode = "login" | "signup";

function sanitizeVaultName(raw: string) {
  const s = raw.trim();
  const out: string[] = [];
  for (const ch of s) {
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "-" || ch === "_") {
      out.push(ch);
    } else if (ch === " " || ch === "\t" || ch === "\n") {
      out.push("_");
    }
  }
  const finalName = out.join("").replace(/^_+|_+$/g, "");
  return finalName;
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authBrand">🔐 PasswordManager</div>
        {children}
        <div className="authFootnote">
          Usuarios = vaults (bases de datos cifradas) dentro de <span className="mono">app_data/vaults</span>. La contraseña
          no se guarda: el login consiste en descifrar el vault.
        </div>
      </div>
    </div>
  );
}

function LoginPage({
  vaults,
  onLogin,
  onGoSignup,
}: {
  vaults: string[];
  onLogin: (vaultName: string, password: string) => void;
  onGoSignup: () => void;
}) {
  const [vault, setVault] = useState(() => vaults[0] ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vault && vaults[0]) setVault(vaults[0]);
  }, [vaults, vault]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!vault) {
      setError("No hay ningún vault seleccionado.");
      return;
    }
    if (!password) {
      setError("La contraseña es obligatoria.");
      return;
    }
    onLogin(vault, password);
  };

  return (
    <AuthCard>
      <div className="authTitle">Iniciar sesión</div>

      <form onSubmit={submit} className="authForm">
        <label className="field">
          <span className="fieldLabel">Vault</span>
          <select className="fieldInput" value={vault} onChange={(e) => setVault(e.target.value)}>
            {vaults.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="fieldLabel">Contraseña</span>
          <input
            className="fieldInput"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña del vault"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="authError">{error}</div>}

        <div className="authActions">
          <button className="btn" type="button" onClick={onGoSignup}>
            Crear vault
          </button>
          <button className="btn btnPrimary" type="submit">
            Entrar
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

function SignupPage({
  onSignup,
  onGoLogin,
}: {
  onSignup: (vaultName: string, password: string) => void;
  onGoLogin: () => void;
}) {
  const [vaultName, setVaultName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => sanitizeVaultName(vaultName), [vaultName]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = sanitizeVaultName(vaultName);
    if (!name) {
      setError("El nombre del vault es obligatorio (solo letras/números/ - _ ).");
      return;
    }
    if (!password) {
      setError("La contraseña es obligatoria.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    onSignup(name, password);
  };

  return (
    <AuthCard>
      <div className="authTitle">Crear vault (Sign up)</div>

      <form onSubmit={submit} className="authForm">
        <label className="field">
          <span className="fieldLabel">Nombre del vault</span>
          <input
            className="fieldInput"
            value={vaultName}
            onChange={(e) => setVaultName(e.target.value)}
            placeholder="Ej: UDC, Personal, Trabajo..."
            autoFocus
          />
        </label>

        {vaultName.trim() && normalized && normalized !== vaultName.trim() && (
          <div className="authFootnote">
            Se guardará como: <span className="mono">{normalized}</span>
          </div>
        )}

        <label className="field">
          <span className="fieldLabel">Contraseña</span>
          <input
            className="fieldInput"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña del vault"
            type="password"
            autoComplete="new-password"
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Repite la contraseña</span>
          <input
            className="fieldInput"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="Repite la contraseña"
            type="password"
            autoComplete="new-password"
          />
        </label>

        {error && <div className="authError">{error}</div>}

        <div className="authActions">
          <button className="btn" type="button" onClick={onGoLogin}>
            Ya tengo vault
          </button>
          <button className="btn btnPrimary" type="submit">
            Crear y entrar
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

export function AuthGate() {
  const [vaults, setVaults] = useState<string[]>([]);
  const [mode, setMode] = useState<AuthMode>("login");
  const [loggedVault, setLoggedVault] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);

  const refresh = async () => {
    const v = await tauriInvoke<string[]>("cmd_list_vaults");
    setVaults(v);
    setMode(v.length > 0 ? "login" : "signup");
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setFatal((e as Error).message ?? String(e));
      }
    })();
  }, []);

  if (fatal) {
    return (
      <AuthCard>
        <div className="authTitle">Error</div>
        <div className="authError">{fatal}</div>
      </AuthCard>
    );
  }

  if (loggedVault) {
    return (
      <AppLayout
        vaultName={loggedVault}
        onLogout={async () => {
          try {
            setBusy(true);
            await tauriInvoke<void>("cmd_close_vault");
          } finally {
            setBusy(false);
            setLoggedVault(null);
            await refresh();
          }
        }}
        logoutDisabled={busy}
      />
    );
  }

  if (mode === "login") {
    return (
      <LoginPage
        vaults={vaults}
        onGoSignup={() => setMode("signup")}
        onLogin={async (vaultName, password) => {
          try {
            setBusy(true);
            await tauriInvoke<void>("cmd_open_vault", { vaultName, password });
            setLoggedVault(vaultName);
          } catch (e) {
            // Devolvemos el error al usuario dentro de la propia pantalla:
            // (lo hacemos con un alert simple para no complicar la UI)
            window.alert((e as Error).message ?? String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  return (
    <SignupPage
      onGoLogin={() => setMode("login")}
      onSignup={async (vaultName, password) => {
        try {
          setBusy(true);
          await tauriInvoke<void>("cmd_create_vault", { vaultName, password });
          await refresh();
          await tauriInvoke<void>("cmd_open_vault", { vaultName, password });
          setLoggedVault(vaultName);
        } catch (e) {
          window.alert((e as Error).message ?? String(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
