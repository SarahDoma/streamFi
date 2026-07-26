import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TokenSelector } from "../../examples/dashboard/src/components/TokenSelector";

describe("TokenSelector rendering", () => {
  it("renders safely when tokens are null or missing", () => {
    const markup = renderToStaticMarkup(
      React.createElement(TokenSelector, {
        tokens: null as unknown as Array<{
          id: string;
          symbol: string;
          name: string;
        }>,
        value: null,
        onChange: () => undefined,
      }),
    );

    expect(markup).toContain("Select token");
  });
});
