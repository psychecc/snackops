import { NextResponse } from "next/server";
import { readJsonFile, updateJsonFile, writeJsonFile } from "@/lib/store";

type StoreCheck = {
  counter: number;
  history: Array<{
    worker: number;
    value: number;
    at: string;
  }>;
};

const TEST_FILE = "__store-lock-test.json";

export async function GET() {
  const snapshot = await readJsonFile<StoreCheck>(TEST_FILE, {
    counter: 0,
    history: [],
  });

  return NextResponse.json({
    ok: true,
    file: TEST_FILE,
    snapshot,
  });
}

export async function POST() {
  await writeJsonFile<StoreCheck>(TEST_FILE, {
    counter: 0,
    history: [],
  });

  const writes = await Promise.all(
    Array.from({ length: 6 }, (_, worker) =>
      updateJsonFile<StoreCheck>(
        TEST_FILE,
        async (current) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          const value = current.counter + 1;
          return {
            counter: value,
            history: [
              ...current.history,
              {
                worker,
                value,
                at: new Date().toISOString(),
              },
            ],
          };
        },
        { counter: 0, history: [] },
      ),
    ),
  );

  const finalSnapshot = await readJsonFile<StoreCheck>(TEST_FILE, {
    counter: 0,
    history: [],
  });

  return NextResponse.json({
    ok: finalSnapshot.counter === 6 && finalSnapshot.history.length === 6,
    file: TEST_FILE,
    writeCount: writes.length,
    finalSnapshot,
  });
}
