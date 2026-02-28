import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AppLayout } from "../app/AppLayout";
import type { User } from "../models/types";

const LS_USERS = "notebook_users_v1";
const LS_SESSION = "notebook_session_v1";

type Session = { userId: string };

function safeLoad<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

function newId(prefix: string) {
  // @ts-expect-error - crypto puede no existir en algunos entornos
  const uuid = typeof crypto !== "undefined" && crypto?.randomUUID ? crypto.randomUUID() : null;
  return uuid ?? `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeUser(u: string) {
  return u.trim().toLowerCase();
}

type AuthMode = "login" | "signup";

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authBrand">📓 Libreta</div>
        {children}
        <div className="authFootnote">
          *Demo local: los usuarios se guardan en tu navegador (localStorage).
        </div>
      </div>
    </div>
  );
}

function LoginPage({
  users,
  onLogin,
  onGoSignup,
}: {
  users: User[];
  onLogin: (userId: string) => void;
  onGoSignup: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const u = users.find((x) => normalizeUser(x.username) === normalizeUser(username));
    if (!u) {
      setError("Ese usuario no existe.");
      return;
    }
    if (u.password !== password) {
      setError("Contraseña incorrecta.");
      return;
    }
    onLogin(u.id);
  };

  return (
    <AuthCard>
      <div className="authTitle">Iniciar sesión</div>

      <form onSubmit={submit} className="authForm">
        <label className="field">
          <span className="fieldLabel">Usuario</span>
          <input
            className="fieldInput"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario"
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Contraseña</span>
          <input
            className="fieldInput"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error && <div className="authError">{error}</div>}

        <div className="authActions">
          <button className="btn" type="button" onClick={onGoSignup}>
            Crear cuenta
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
  users,
  onSignup,
  onGoLogin,
}: {
  users: User[];
  onSignup: (payload: { username: string; password: string }) => void;
  onGoLogin: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    if (!u) {
      setError("El usuario es obligatorio.");
      return;
    }
    if (users.some((x) => normalizeUser(x.username) === normalizeUser(u))) {
      setError("Ese usuario ya existe.");
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

    onSignup({ username: u, password });
  };

  return (
    <AuthCard>
      <div className="authTitle">Crear cuenta</div>

      <form onSubmit={submit} className="authForm">
        <label className="field">
          <span className="fieldLabel">Usuario</span>
          <input
            className="fieldInput"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Elige un usuario"
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="field">
          <span className="fieldLabel">Contraseña</span>
          <input
            className="fieldInput"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Crea una contraseña"
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
            Ya tengo cuenta
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
  const [users, setUsers] = useState<User[]>(() => safeLoad<User[]>(LS_USERS) ?? []);
  const [mode, setMode] = useState<AuthMode>(() => {
    const existing = safeLoad<User[]>(LS_USERS) ?? [];
    return existing.length > 0 ? "login" : "signup";
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    const session = safeLoad<Session>(LS_SESSION);
    const existing = safeLoad<User[]>(LS_USERS) ?? [];
    if (session?.userId && existing.some((u) => u.id === session.userId)) return session.userId;
    return null;
  });

  // Persistimos usuarios
  useEffect(() => {
    safeSave(LS_USERS, users);
  }, [users]);

  // Persistimos sesión (o la borramos)
  useEffect(() => {
    if (currentUserId) safeSave(LS_SESSION, { userId: currentUserId } as Session);
    else safeRemove(LS_SESSION);
  }, [currentUserId]);

  // Si cambia el número de usuarios y NO hay sesión, ajustamos el modo inicial
  useEffect(() => {
    if (currentUserId) return;
    setMode(users.length > 0 ? "login" : "signup");
  }, [users.length, currentUserId]);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) ?? null;
  }, [users, currentUserId]);

  if (currentUser) {
    return (
      <AppLayout
        userId={currentUser.id}
        userName={currentUser.username}
        onLogout={() => {
          setCurrentUserId(null);
          setMode(users.length > 0 ? "login" : "signup");
        }}
      />
    );
  }

  if (mode === "login") {
    return (
      <LoginPage
        users={users}
        onLogin={(userId) => setCurrentUserId(userId)}
        onGoSignup={() => setMode("signup")}
      />
    );
  }

  return (
    <SignupPage
      users={users}
      onSignup={({ username, password }) => {
        const user: User = { id: newId("u"), username, password, createdAt: Date.now() };
        setUsers((prev) => [...prev, user]);
        setCurrentUserId(user.id);
      }}
      onGoLogin={() => setMode("login")}
    />
  );
}
