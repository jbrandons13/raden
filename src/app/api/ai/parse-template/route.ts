import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { templateText, staffList, dates, shiftTypes } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not defined in environment variables" }, { status: 500 });
    }

    // Helper using UTCDay to avoid timezone shifts with YYYY-MM-DD strings
    const getIndoDay = (dateStr: string) => {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const date = new Date(dateStr);
      return days[date.getUTCDay()];
    };

    const systemPrompt = `
      You are an expert data extractor for a staff scheduler.
      Your task is to parse a staff availability template and extract the parameters into JSON.
      
      Staff List Available: ${JSON.stringify(staffList.map((s: any) => ({ id: s.id, name: s.name })))}
      Valid Shift Types: ${JSON.stringify(shiftTypes)}
      
      Rules for Extraction:
      1. Identify staff_id from the "Nama" field.
      2. Identify available_days: a list of full Indonesian day names (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu).
         Example: "Jumat-Minggu" -> ["Jumat", "Sabtu", "Minggu"]
      3. Identify shift_code: The shift specified (e.g. "EM" or "M").
      4. Identify exclusion_dates: A list of specific dates (YYYY-MM-DD or just DD) mentioned as unavailable.
      
      Output ONLY this JSON:
      {
        "staff_id": "uuid",
        "staff_name": "name",
        "available_days": ["Hari1", "Hari2", ...],
        "exclusion_dates": ["YYYY-MM-DD", ...],
        "shift_code": "CODE",
        "summary": "short summary"
      }
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `TEMPLATE TEXT:\n${templateText}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "Groq API Error");

    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("AI failed to produce a response");

    const extraction = JSON.parse(content);

    // LOGIC IN JS: Build the mappings accurately
    const mappings: Record<string, string> = {};
    const targetDays = extraction.available_days || [];
    const exclusions = extraction.exclusion_dates || [];
    const shiftCode = extraction.shift_code || "EM";

    dates.forEach(d => {
      const dayName = getIndoDay(d);
      const dayNum = new Date(d).getUTCDate().toString(); // Handle "tanggal 1" etc
      
      const isExcluded = exclusions.some((ex: string) => 
        ex === d || ex === dayNum || ex.endsWith(`-${dayNum.padStart(2, '0')}`)
      );

      if (targetDays.includes(dayName) && !isExcluded) {
        mappings[d] = shiftCode;
      }
    });

    const finalResult = {
      staff_id: extraction.staff_id,
      staff_name: extraction.staff_name,
      mappings,
      summary: extraction.summary
    };

    console.log("=== HYBRID PARSED RESULT ===");
    console.log(JSON.stringify(finalResult, null, 2));

    return NextResponse.json(finalResult);
  } catch (error: any) {
    console.error("AI Parse Error (Groq):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
