import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    if (!password) {
      return new Response(JSON.stringify({ success: false, error: "Пароль не предоставлен" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Читаем секрет из переменных окружения Edge Function
    const masterPassword = Deno.env.get("REPOPART_MASTER_PASSWORD");
    
    console.log("Секрет найден:", masterPassword ? "да" : "нет");
    console.log("Пароль совпадает:", password === masterPassword);

    const isValid = password === masterPassword;

    return new Response(JSON.stringify({ success: isValid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Критическая ошибка:", err);
    return new Response(JSON.stringify({ success: false, error: "Внутренняя ошибка" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});