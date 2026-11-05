import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RadioGroup } from "./RadioGroup";

const options = [
  ["a", "Alpha"],
  ["b", "Beta"],
  ["c", "Gamma"],
] as const;

function setup(value: "a" | "b" | "c" = "a") {
  const onChange = vi.fn();
  render(
    <RadioGroup
      label="Letters"
      value={value}
      options={options}
      onChange={onChange}
    />,
  );
  return onChange;
}

const radio = (name: string) => screen.getByRole("radio", { name });

test("only the checked option is in the tab order", () => {
  setup("b");
  expect(radio("Alpha")).toHaveAttribute("tabindex", "-1");
  expect(radio("Beta")).toHaveAttribute("tabindex", "0");
  expect(radio("Gamma")).toHaveAttribute("tabindex", "-1");
});

test("the first option is tabbable when the value matches none", () => {
  const onChange = vi.fn();
  render(
    <RadioGroup
      label="L"
      value={"zzz" as "a"}
      options={options}
      onChange={onChange}
    />,
  );
  expect(radio("Alpha")).toHaveAttribute("tabindex", "0");
});

test("arrows move focus and selection with wrap", async () => {
  const onChange = setup("c");
  radio("Gamma").focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith("a");
  expect(radio("Alpha")).toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  expect(onChange).toHaveBeenLastCalledWith("c");
  await userEvent.keyboard("{ArrowDown}");
  expect(onChange).toHaveBeenLastCalledWith("a");
  await userEvent.keyboard("{ArrowUp}");
  expect(onChange).toHaveBeenLastCalledWith("c");
});

test("Home and End jump to the ends", async () => {
  const onChange = setup("b");
  radio("Beta").focus();
  await userEvent.keyboard("{End}");
  expect(onChange).toHaveBeenLastCalledWith("c");
  expect(radio("Gamma")).toHaveFocus();
  await userEvent.keyboard("{Home}");
  expect(onChange).toHaveBeenLastCalledWith("a");
});

test("Space and Enter select the focused option", async () => {
  const onChange = setup("a");
  radio("Beta").focus();
  await userEvent.keyboard(" ");
  expect(onChange).toHaveBeenLastCalledWith("b");
  onChange.mockClear();
  await userEvent.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledWith("b");
});

test("arrows with Alt, Ctrl or Meta held are left alone", async () => {
  const onChange = setup("b");
  radio("Beta").focus();
  for (const mod of ["Alt", "Control", "Meta"]) {
    await userEvent.keyboard(`{${mod}>}{ArrowRight}{/${mod}}`);
  }
  await userEvent.keyboard("{Alt>}{Home}{/Alt}");
  expect(onChange).not.toHaveBeenCalled();
  expect(radio("Beta")).toHaveFocus();
});
