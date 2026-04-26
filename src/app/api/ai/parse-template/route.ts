import { NextResponse } from "next/server";

interface MappingRequest {
  templateText: string;
  staffList: any[];
  dates: string[];
  shiftTypes: string[];
}

export async function POST(req: Request) {
  try {
    const { templateText, staffList, dates, shiftTypes }: MappingRequest = await req.json();

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
      Your task is to parse a staff availability template and extract parameters into a strict JSON format.
      
      Staff List Available: ${JSON.stringify(staffList.map((s: any) => ({ id: s.id, name: s.name })))}
      Valid Shift Types: ${JSON.stringify(shiftTypes)}
      
      Rules for Extraction:
      1. staff_id: Find the EXACT matches from "Staff List Available". If multiple names match, pick the most relevant one.
      2. available_days: Extract all mentioned days. 
         - Format must be standard Indonesian: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
         - Handle ranges: "Senin-Rabu" must be expanded to ["Senin", "Selasa", "Rabu"]
         - Handle lists: "Selasa, Rabu, Minggu" must be ["Selasa", "Rabu", "Minggu"]
         - Handle mixed: "Senin-Rabu dan Sabtu" must be ["Senin", "Selasa", "Rabu", "Sabtu"]
      3. shift_code: Identify the shift code (e.g., "EM", "M", "EMS"). Use the EXACT code from "Valid Shift Types". Default to "EM" if unclear.
      4. exclusion_dates: Identify specific dates the staff is UNAVAILABLE. 
         - Format: ["YYYY-MM-DD", "DD"]
      
      Output ONLY this JSON structure:
      {
        "staff_id": "uuid",
        "staff_name": "name",
        "available_days": ["Senin", "Selasa", ...],
        "exclusion_dates": ["2026-04-01", "15", ...],
        "shift_code": "CODE",
        "summary": "Explaining the logic used for this extraction"
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

    // LOGIC IN JS: Build the mappings accurately with trimming
    const mappings: Record<string, string> = {};
    const rawTargetDays = extraction.available_days || [];
    const targetDays = rawTargetDays.map((d: string) => d.trim());
    const exclusions = (extraction.exclusion_dates || []).map((e: any) => String(e).trim());
    const shiftCode = String(extraction.shift_code || "EM").trim();

    dates.forEach((d: string) => {
      const dayName = getIndoDay(d);
      const dateObj = new Date(d);
      const dayNum = dateObj.getUTCDate().toString();
      
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
