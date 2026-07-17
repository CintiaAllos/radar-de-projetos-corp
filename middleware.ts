import { NextRequest, NextResponse } from "next/server";

// Trava de acesso ao app inteiro (páginas + API).
// Só fica ativa quando a variável RADAR_ACCESS_PASSWORD estiver definida na Vercel.
// Enquanto ela não existir, o app segue aberto (para não trancar você para fora
// antes de configurar). O usuário (RADAR_ACCESS_USER) é opcional: se não for
// definido, qualquer nome é aceito, desde que a senha esteja correta.
export function middleware(request: NextRequest) {
  const requiredPassword = process.env.RADAR_ACCESS_PASSWORD;
  const requiredUser = process.env.RADAR_ACCESS_USER;

  // Proteção desativada enquanto a senha não for configurada.
  if (!requiredPassword) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      let decoded = "";
      try {
        decoded = atob(encoded);
      } catch {
        decoded = "";
      }
      const separator = decoded.indexOf(":");
      const user = separator >= 0 ? decoded.slice(0, separator) : "";
      const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      const userOk = !requiredUser || user === requiredUser;
      if (userOk && password === requiredPassword) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Acesso restrito. Informe usuário e senha.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Radar de Projetos", charset="UTF-8"',
    },
  });
}

// Aplica a todas as rotas, exceto os arquivos estáticos internos do Next e o logo.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|allos-logo.png).*)",
  ],
};
