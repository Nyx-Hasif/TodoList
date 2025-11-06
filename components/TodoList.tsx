"use client";
import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image"; // Import Next.js Image

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  image_url?: string;
  image_name?: string;
  created_at: string;
}

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch todos
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error("Error fetching todos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Upload image to Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;
      const filePath = fileName;

      // Upload to storage bucket 'todo-images'
      const { error } = await supabase.storage // Removed unused 'data'
        .from("todo-images")
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("todo-images")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Error uploading image!");
      return null;
    }
  };

  // Add todo with optional image
  const addTodo = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      setUploading(true);
      let imageUrl = null;
      let imageName = null;

      // Upload image if selected
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
        imageName = selectedFile.name;

        if (!imageUrl) {
          setUploading(false);
          return; // Stop if image upload failed
        }
      }

      // Save todo to database
      const { data, error } = await supabase
        .from("todos")
        .insert([
          {
            title: newTodo,
            image_url: imageUrl,
            image_name: imageName,
          },
        ])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setTodos([data[0], ...todos]);
        setNewTodo("");
        setSelectedFile(null);

        // Reset file input
        const fileInput = document.getElementById(
          "file-input"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      }
    } catch (error) {
      console.error("Error adding todo:", error);
      alert("Error adding todo!");
    } finally {
      setUploading(false);
    }
  };

  // Toggle complete
  const toggleComplete = async (
    id: string,
    completed: boolean
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ completed: !completed })
        .eq("id", id);

      if (error) throw error;

      setTodos(
        todos.map((todo) =>
          todo.id === id ? { ...todo, completed: !completed } : todo
        )
      );
    } catch (error) {
      console.error("Error updating todo:", error);
    }
  };

  // Delete todo (with image cleanup)
  const deleteTodo = async (id: string, imageUrl?: string): Promise<void> => {
    try {
      // Delete from database first
      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (error) throw error;

      // Delete image from storage if exists
      if (imageUrl) {
        const fileName = imageUrl.split("/").pop();
        if (fileName) {
          await supabase.storage.from("todo-images").remove([fileName]);
        }
      }

      setTodos(todos.filter((todo) => todo.id !== id));
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Todo List with Images
      </h1>

      {/* Add Todo Form */}
      <form onSubmit={addTodo} className="mb-6 space-y-4">
        <div className="space-y-3">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add new todo..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Add Image (Optional)
            </label>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedFile && (
              <p className="text-sm text-gray-600">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading || !newTodo.trim()}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Adding Todo..." : "Add Todo"}
        </button>
      </form>

      {/* Todo List */}
      <div className="space-y-4">
        {todos.map((todo: Todo) => (
          <div
            key={todo.id}
            className="p-4 border border-gray-200 rounded-lg bg-gray-50"
          >
            {/* Todo Header */}
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleComplete(todo.id, todo.completed)}
                className="w-4 h-4 text-blue-600"
              />
              <span
                className={`flex-1 font-medium ${
                  todo.completed
                    ? "line-through text-gray-500"
                    : "text-gray-800"
                }`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id, todo.image_url)}
                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Display Image with Next.js Image component */}
            {todo.image_url && (
              <div className="mt-3">
                <div className="relative w-full max-w-md h-48">
                  <Image
                    src={todo.image_url}
                    alt={todo.title}
                    fill
                    className="object-cover rounded-md border border-gray-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                {todo.image_name && (
                  <p className="text-xs text-gray-500 mt-1">
                    {todo.image_name}
                  </p>
                )}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-gray-400 mt-2">
              Created: {new Date(todo.created_at).toLocaleString()}
            </p>
          </div>
        ))}

        {todos.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No todos yet. Add one above!
          </p>
        )}
      </div>
    </div>
  );
}
